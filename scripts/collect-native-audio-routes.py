"""Read this task's completed owned Orca fixture locally, without printing PCM.
This uses loopback Orca IPC; no recordings or fixture media are uploaded.
"""
import argparse
import json
import os
import pathlib
import subprocess

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--page',required=True)
parser.add_argument('--output',required=True)
args=parser.parse_args()
command=os.environ.get('ORCA_CLI_COMMAND') or 'orca-ide'

def evaluate(expression):
    result=subprocess.run([command,'eval','--page',args.page,'--expect-url','http://127.0.0.1:4173/tests/browser/index.html','--expression',expression,'--json'],capture_output=True,text=True,check=True)
    wrapper=json.loads(result.stdout)
    if not wrapper['ok']:
        raise RuntimeError(wrapper.get('error'))
    return json.loads(wrapper['result']['result'])

header=evaluate('JSON.stringify((()=>{if(document.querySelector("#task112-status").textContent!=="Complete"||!window.nativeResearchResult)throw Error("Native research is not complete");const{windows,...rest}=window.nativeResearchResult;return{...rest,windowCount:windows.length};})())')
windows=[]
for offset in range(0,header.pop('windowCount'),4):
    windows.extend(evaluate(f'JSON.stringify(window.nativeResearchResult.windows.slice({offset},{offset+4}))'))
output=pathlib.Path(args.output)
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({**header,'windows':windows},indent=2)+'\n')
print(f'Saved {len(windows)} native windows locally to {output}; PCM not printed or uploaded.')
