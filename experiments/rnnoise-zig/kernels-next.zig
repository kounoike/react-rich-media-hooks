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
                var accum: [8 / lanes]V = @splat(@splat(0));
                for (0..blocks) |_| {
                    const pos: usize = @intCast(indices[ix]);
                    ix += 1;
                    inline for (0..4) |k| {
                        const x: V = @splat(input[pos + k]);
                        inline for (0..8 / lanes) |group| {
                            const w: V = weights[wi + k * 8 + group * lanes ..][0..lanes].*;
                            accum[group] = accum[group] + w * x;
                        }
                    }
                    wi += 32;
                }
                inline for (0..8 / lanes) |group| output[row + group * lanes ..][0..lanes].* = accum[group];
            }
        } else {
            counts[0] +%= 1;
            var row: usize = 0;
            while (row + 16 <= rows) : (row += 16) {
                var accum: [16 / lanes]V = @splat(@splat(0));
                for (0..cols) |col| {
                    const x: V = @splat(input[col]);
                    inline for (0..16 / lanes) |group| {
                        const w: V = weights[col * rows + row + group * lanes ..][0..lanes].*;
                        accum[group] = accum[group] + w * x;
                    }
                }
                inline for (0..16 / lanes) |group| output[row + group * lanes ..][0..lanes].* = accum[group];
            }
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

// /*Copyright (c) 2003-2004, Mark Borgerding
//   Lots of modifications by Jean-Marc Valin
//   Copyright (c) 2005-2007, Xiph.Org Foundation
//   Copyright (c) 2008,      Xiph.Org Foundation, CSIRO
//
//   All rights reserved.
//
//   Redistribution and use in source and binary forms, with or without
//    modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//        this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright notice,
//        this list of conditions and the following disclaimer in the
//        documentation and/or other materials provided with the distribution.
//
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
//   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
//   IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
//   ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
//   LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
//   CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
//   SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
//   INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
//   CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
//   ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
//   POSSIBILITY OF SUCH DAMAGE.*/

const Complex = extern struct { r: f32, i: f32 };
const CV = struct { r: V, i: V };
var fft4_calls: u32 = 0;
export fn experiment_fft4_calls() u32 {
    return fft4_calls;
}
fn loadComplex(p: [*]const Complex, offset: usize, stride: usize) CV {
    var r: [lanes]f32 = undefined;
    var i: [lanes]f32 = undefined;
    inline for (0..lanes) |l| {
        r[l] = p[offset + l * stride].r;
        i[l] = p[offset + l * stride].i;
    }
    return .{ .r = r, .i = i };
}
fn storeComplex(p: [*]Complex, offset: usize, stride: usize, v: CV) void {
    inline for (0..lanes) |l| {
        p[offset + l * stride] = .{ .r = v.r[l], .i = v.i[l] };
    }
}
fn plus(a: CV, b: CV) CV {
    @setFloatMode(.strict);
    return .{ .r = a.r + b.r, .i = a.i + b.i };
}
fn minus(a: CV, b: CV) CV {
    @setFloatMode(.strict);
    return .{ .r = a.r - b.r, .i = a.i - b.i };
}
fn multiply(a: CV, b: CV) CV {
    @setFloatMode(.strict);
    return .{ .r = a.r * b.r - a.i * b.i, .i = a.r * b.i + a.i * b.r };
}
// Fixed-model FFT: radix 4 only; existing C radix 2/3/5, bit reversal and scaling retained.
export fn experiment_fft4(output: [*]Complex, twiddles: [*]const Complex, fstride: usize, m_int: c_int, n_int: c_int, mm_int: c_int) void {
    @setFloatMode(.strict);
    fft4_calls +%= 1;
    const m: usize = @intCast(m_int);
    const n: usize = @intCast(n_int);
    const mm: usize = @intCast(mm_int);
    if (m == 1) {
        var group: usize = 0;
        while (group < n) : (group += lanes) {
            const base = group * 4;
            const a = loadComplex(output, base, 4);
            const b = loadComplex(output, base + 1, 4);
            const c = loadComplex(output, base + 2, 4);
            const d = loadComplex(output, base + 3, 4);
            const diff = minus(a, c);
            const sum = plus(a, c);
            const bd_sum = plus(b, d);
            const bd_diff = minus(b, d);
            storeComplex(output, base, 4, plus(sum, bd_sum));
            storeComplex(output, base + 2, 4, minus(sum, bd_sum));
            storeComplex(output, base + 1, 4, .{ .r = diff.r + bd_diff.i, .i = diff.i - bd_diff.r });
            storeComplex(output, base + 3, 4, .{ .r = diff.r - bd_diff.i, .i = diff.i + bd_diff.r });
        }
    } else {
        for (0..n) |group| {
            var j: usize = 0;
            while (j < m) : (j += lanes) {
                const base = group * mm + j;
                const a = loadComplex(output, base, 1);
                const b = multiply(loadComplex(output, base + m, 1), loadComplex(twiddles, j * fstride, fstride));
                const c = multiply(loadComplex(output, base + 2 * m, 1), loadComplex(twiddles, j * fstride * 2, fstride * 2));
                const d = multiply(loadComplex(output, base + 3 * m, 1), loadComplex(twiddles, j * fstride * 3, fstride * 3));
                const diff = minus(a, c);
                const sum = plus(a, c);
                const bd_sum = plus(b, d);
                const bd_diff = minus(b, d);
                storeComplex(output, base, 1, plus(sum, bd_sum));
                storeComplex(output, base + 2 * m, 1, minus(sum, bd_sum));
                storeComplex(output, base + m, 1, .{ .r = diff.r + bd_diff.i, .i = diff.i - bd_diff.r });
                storeComplex(output, base + 3 * m, 1, .{ .r = diff.r - bd_diff.i, .i = diff.i + bd_diff.r });
            }
        }
    }
}
