// Experimental port of pinned RNNoise nnet_arch.h / vec.h; never a production engine.
// Copyright (c) 2008-2011 Octasic Inc.
// Copyright (c) 2012-2017 Jean-Marc Valin
// /* Copyright (c) 2018-2019 Mozilla
//                  2023 Amazon */
// /*
//    Redistribution and use in source and binary forms, with or without
//    modification, are permitted provided that the following conditions
//    are met:
//
//    - Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
//    - Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
//    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
//    ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
//    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
//    A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE FOUNDATION OR
//    CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
//    EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
//    PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
//    PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
//    LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//    NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
//    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
// */

const builtin = @import("builtin");
const simd = stdTargetSimd();
fn stdTargetSimd() bool {
    return @import("std").Target.wasm.featureSetHas(builtin.cpu.features, .simd128);
}
const lanes = if (simd) 4 else 1;
const V = @Vector(lanes, f32);
const Linear = extern struct {
    bias: ?[*]const f32,
    subias: ?[*]const f32,
    weights: ?[*]const i8,
    float_weights: ?[*]const f32,
    weights_idx: ?[*]const c_int,
    diag: ?[*]const f32,
    scale: ?[*]const f32,
    nb_inputs: c_int,
    nb_outputs: c_int,
};
var counts: [4]u32 = @splat(0);
export fn experiment_dense_float_calls() u32 {
    return counts[0];
}
export fn experiment_sparse_float_calls() u32 {
    return counts[1];
}
export fn experiment_dense_q8_calls() u32 {
    return counts[2];
}
export fn experiment_sparse_q8_calls() u32 {
    return counts[3];
}
export fn experiment_port_revision() u32 {
    return 1;
}

// Output lanes stay independent; no horizontal reduction, approximate activation,
// fast-math, FMA, relaxed SIMD or reduction reordering is introduced.
export fn rnn_compute_linear_c(layer: *const Linear, output: [*]f32, input: [*]const f32) void {
    @setFloatMode(.strict);
    const rows: usize = @intCast(layer.nb_outputs);
    const cols: usize = @intCast(layer.nb_inputs);
    @memset(output[0..rows], 0);
    if (layer.float_weights) |weights| {
        if (layer.weights_idx) |indices| {
            counts[1] +%= 1;
            var wi: usize = 0;
            var ix: usize = 0;
            var row: usize = 0;
            while (row < rows) : (row += 8) {
                const blocks: usize = @intCast(indices[ix]);
                ix += 1;
                for (0..blocks) |_| {
                    const pos: usize = @intCast(indices[ix]);
                    ix += 1;
                    var lane: usize = 0;
                    while (lane < 8) : (lane += lanes) {
                        var acc: V = output[row + lane ..][0..lanes].*;
                        inline for (0..4) |k| {
                            const w: V = weights[wi + k * 8 + lane ..][0..lanes].*;
                            acc = acc + w * @as(V, @splat(input[pos + k]));
                        }
                        output[row + lane ..][0..lanes].* = acc;
                    }
                    wi += 32;
                }
            }
        } else {
            counts[0] +%= 1;
            var row: usize = 0;
            while (row + lanes <= rows) : (row += lanes) {
                var acc: V = @splat(0);
                for (0..cols) |col| {
                    const w: V = weights[col * rows + row ..][0..lanes].*;
                    acc = acc + w * @as(V, @splat(input[col]));
                }
                output[row..][0..lanes].* = acc;
            }
            while (row < rows) : (row += 1) {
                var acc: f32 = 0;
                for (0..cols) |col| acc += weights[col * rows + row] * input[col];
                output[row] = acc;
            }
        }
    } else if (layer.weights) |weights| {
        var quantized: [2048]i8 = undefined;
        for (0..cols) |i| {
            // Upstream: (int)floor(.5 + 127 * input), then signed int8 storage.
            const product: f32 = 127 * input[i];
            const rounded: i32 = @intFromFloat(@floor(0.5 + @as(f64, product)));
            quantized[i] = @truncate(rounded);
        }
        counts[if (layer.weights_idx == null) @as(usize, 2) else 3] +%= 1;
        var wi: usize = 0;
        var ix: usize = 0;
        var row: usize = 0;
        while (row < rows) : (row += 8) {
            const blocks: usize = if (layer.weights_idx) |indices| blk: {
                const value: usize = @intCast(indices[ix]);
                ix += 1;
                break :blk value;
            } else cols / 4;
            for (0..blocks) |block| {
                const pos: usize = if (layer.weights_idx) |indices| blk: {
                    const value: usize = @intCast(indices[ix]);
                    ix += 1;
                    break :blk value;
                } else block * 4;
                var lane: usize = 0;
                while (lane < 8) : (lane += lanes) {
                    var terms: [4]V = undefined;
                    inline for (0..4) |k| {
                        var w: [lanes]f32 = undefined;
                        inline for (0..lanes) |l| w[l] = @floatFromInt(weights[wi + (lane + l) * 4 + k]);
                        terms[k] = @as(V, w) * @as(V, @splat(@as(f32, @floatFromInt(quantized[pos + k]))));
                    }
                    const dot = ((terms[0] + terms[1]) + terms[2]) + terms[3];
                    const previous: V = output[row + lane ..][0..lanes].*;
                    output[row + lane ..][0..lanes].* = previous + dot;
                }
                wi += 32;
            }
        }
        for (0..rows) |i| output[i] *= layer.scale.?[i];
    }
    if (layer.bias) |bias| for (0..rows) |i| {
        output[i] += bias[i];
    };
    if (layer.diag) |diag| {
        for (0..cols) |i| {
            output[i] += diag[i] * input[i];
            output[i + cols] += diag[i + cols] * input[i];
            output[i + 2 * cols] += diag[i + 2 * cols] * input[i];
        }
    }
}
