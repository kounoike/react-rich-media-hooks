/* RNNoise v0.2's portable vec.h includes an absent Opus header for this one macro.
 * Supply the same zeroing operation without adding the Opus runtime. */
#ifndef RRMH_OS_SUPPORT_H
#define RRMH_OS_SUPPORT_H
#include <string.h>
#define OPUS_CLEAR(destination, count) memset((destination), 0, sizeof(*(destination)) * (count))
#endif
