const DenoiseState = opaque {};
extern fn rnnoise_get_size() c_int;
extern fn rnnoise_get_frame_size() c_int;
extern fn rnnoise_init(state: *DenoiseState, model: ?*anyopaque) c_int;
extern fn rnnoise_process_frame(state: *DenoiseState, output: [*]f32, input: [*]const f32) f32;

// One instance belongs to one session processor. No allocator or growing heap is used.
var state: [65_536]u8 align(64) = @splat(0);
var frame: [480]f32 = @splat(0);
var initialized = false;

export fn engine_abi_version() u32 {
    return 1;
}

export fn engine_init() u32 {
    const size = rnnoise_get_size();
    if (size <= 0 or size > state.len or rnnoise_get_frame_size() != frame.len) return 1;
    initialized = rnnoise_init(@ptrCast(&state), null) == 0;
    return if (initialized) 0 else 2;
}

export fn engine_frame_ptr() usize {
    return @intFromPtr(&frame);
}

export fn engine_process() f32 {
    if (!initialized) return -1;
    return rnnoise_process_frame(@ptrCast(&state), &frame, &frame);
}

export fn engine_dispose() void {
    @memset(&state, 0);
    @memset(&frame, 0);
    initialized = false;
}
