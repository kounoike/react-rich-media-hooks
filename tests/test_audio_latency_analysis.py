import pathlib
import sys
import unittest
import numpy as np
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
from audio_latency_analysis import score_window, distribution, summarize

class LatencyMeasurementTests(unittest.TestCase):
    def window(self, delay=0, phase='known-0'):
        rng=np.random.default_rng(1212); source=rng.normal(size=22000); start=5000
        return {'phase':phase,'sequence':0,'startFrame':15000,'endFrame':63000,'droppedWindows':0,
                'a':source[start:start+16000].tolist(),'b':source[start-delay:start+16000-delay].tolist()}
    def test_known_delays_in_exact_one_second_windows(self):
        for delay in [0,160,480,960,1440]:
            with self.subTest(delay=delay):
                row=score_window(self.window(delay),[]);self.assertTrue(row['accepted']);self.assertEqual(row['lagMs'],delay/16)
    def test_incomplete_or_discontinuous_window_is_not_a_latency_sample(self):
        window=self.window();window['endFrame']+=3
        self.assertEqual(score_window(window,[])['excluded'],'incomplete-or-discontinuous-one-second-window')
    def test_state_at_sample_time_wins_over_later_message_receipt(self):
        window=self.window(480,'rnnoise-generic')
        history=[{'frame':0,'status':'active','original':False},{'frame':70000,'status':'degraded','original':True}]
        row=score_window(window,history);self.assertTrue(row['processed'])
    def test_state_and_output_transitions_reject_windows(self):
        for changed in [{'status':'degraded','original':True},{'status':'active','original':True}]:
            history=[{'frame':0,'status':'active','original':False},{'frame':30000,**changed}]
            row=score_window(self.window(480,'rnnoise-generic'),history);self.assertFalse(row['accepted']);self.assertEqual(row['excluded'],'processor-or-output-transition')
    def test_original_fallback_never_counts_as_processed(self):
        row=score_window(self.window(0,'rnnoise-simd128'),[{'frame':0,'status':'degraded','original':True}])
        self.assertTrue(row['accepted']);self.assertFalse(row['processed']);self.assertEqual(row['path'],'original-fallback')
    def test_nonfinite_and_missing_buffers_are_rejected(self):
        window=self.window();window['a'][1]=float('nan');self.assertFalse(score_window(window,[])['accepted'])
        window=self.window();window['b'].pop();self.assertFalse(score_window(window,[])['accepted'])
    def test_collector_backpressure_rejects_latency(self):
        window = self.window(); window['droppedWindows'] = 1
        self.assertEqual(score_window(window, [])['excluded'], 'collector-backpressure')
    def test_late_fallback_disqualifies_a_whole_native_phase(self):
        windows = []
        for delay in [0, 30, 60]:
            windows.extend([self.window(delay * 16, f'known-{delay}') for _ in range(3)])
        windows.extend([self.window() | {'phase': 'original'} for _ in range(3)])
        for index in range(8):
            windows.append(self.window(480, 'rnnoise-generic') | {
                'startFrame': 150000 + index * 48000, 'endFrame': 198000 + index * 48000})
        report = summarize({'windows': windows, 'captureRate': 16000, 'profiles': [], 'history': [
            {'frame': 100000, 'status': 'active', 'original': False},
            {'frame': 533000, 'status': 'degraded', 'original': True}]})
        phase = report['phases']['rnnoise-generic']
        self.assertEqual(phase['latencyMs']['count'], 7)
        self.assertTrue(phase['fallbackDuringCapture'])
        self.assertFalse(phase['qualifiedProbe'])
        self.assertIsNone(phase['incrementalMs'])
    def test_added_latency_keeps_graph_delay_and_uses_original_baseline(self):
        windows = []
        for delay in [0, 30, 60]:
            windows.extend([self.window(delay * 16, f'known-{delay}') for _ in range(3)])
        windows.extend([self.window(20 * 16, 'original') for _ in range(4)])
        windows.extend([self.window(60 * 16, 'graph-0') for _ in range(4)])
        for index in range(6):
            windows.append(self.window(90 * 16, 'rnnoise-zig-generic') | {
                'startFrame': 150000 + index * 48000, 'endFrame': 198000 + index * 48000})
        report = summarize({'windows': windows, 'captureRate': 16000, 'profiles': [], 'history': [
            {'frame': 100000, 'status': 'active', 'original': False}]})
        added = report['phases']['rnnoise-zig-generic']['incrementalMs']['p95']
        self.assertEqual(added, 70)
        self.assertGreater(added, 40)  # Subtracting the graph would incorrectly report 30 ms.
    def test_rank_percentiles_do_not_interpolate_latency(self):
        self.assertEqual(distribution(range(1,101)),{'count':100,'p50':50.,'p95':95.,'p99':99.,'max':100.})

if __name__ == '__main__':unittest.main()
