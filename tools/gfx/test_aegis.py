import sys; sys.path.insert(0,'tools/gfx')
from lib import svg
from aegis import aegis
for pose in ['idle','wave','guard','damaged']:
    open(f'/tmp/claude-0/r/a_{pose}.svg','w').write(svg(aegis(pose)))
