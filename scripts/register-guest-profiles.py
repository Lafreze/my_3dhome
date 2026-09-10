"""Register the authored facial landmarks after prepare-guest-figures.py.
Landmarks were traced on normalized 800x1000 orthographic source portraits.
Run from the repository root; keeps existing visitors' rest profiles unchanged.
"""
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
landmarks={
'noir': [[[321,299,299],[330,295,313],[341,294,321],[353,295,323],[365,299,321],[376,304,311],[382,307,307]],[[422,307,307],[429,299,318],[440,295,323],[452,294,323],[465,295,320],[476,299,312],[483,301,301]]],
'rose': [[[313,287,287],[321,286,305],[334,287,315],[348,290,319],[360,294,316],[370,300,310],[377,304,304]],[[426,302,302],[434,294,314],[446,289,318],[460,287,315],[471,285,309],[482,283,295],[488,283,283]]]
}
profiles={};rest=json.loads((root/'app/visitor-rest-poses.json').read_text())
for kind in ['noir','rose']:
 m=json.loads((root/f'public/models/visitor-{kind}.json').read_text());fit=m['fitScale'];contact=m['contact']
 profiles[kind]={'motionRig':m['motionRig'],'eyelids':[[[round((x-400)*.00155*fit,6),round((.65+(500-y)*.00155-contact)*fit,6),round((.65+(500-z)*.00155-contact)*fit,6)]for x,y,z in eye]for eye in landmarks[kind]]};rest[kind]=m['restPose']
(root/'app/visitor-figure-profiles.json').write_text(json.dumps(profiles,indent=2)+'\n');(root/'app/visitor-rest-poses.json').write_text(json.dumps(rest,indent=2)+'\n')
