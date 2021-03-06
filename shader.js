var REGL = require('regl')
var ndarray = require('ndarray')
var surfaceNets = require('surface-nets')
var scale = require('./scale.js')

module.exports = function (opts, src) {
  if (typeof opts === 'number') {
    opts = { size: [opts,opts,opts] }
  }
  if (Array.isArray(opts)) {
    opts = { size: opts }
  }
  var precision = opts.precision || 'medium'
  var size = opts.size
  var len = size[0] * size[1] * size[2]

  var sx = st(size[0]), sy = st(size[1]), sz = st(size[2])
  var isx = st(2/(size[0]-1)), isy = st(2/(size[1]-1)), isz = st(2/(size[2]-1))
  var isxy = st(1/(size[0]*size[1]))
  var sq = Math.ceil(Math.sqrt(len))
  var canvas = document.createElement('canvas')
  var regl = REGL(canvas)
  var magic = {
    '64,64,64': (sq + size[0]*4)*4,
    '128,128,128': (sq + size[0]*16)*4,
    '100,100,100': (sq + size[0]*10)*4,
    '50,50,50': (sq + size[0]*2+18)*4
  }
  var draw = regl({
    framebuffer: regl.prop('framebuffer'),
    frag: `
      precision ${precision}p float;
      ${src}
      float isurface (float i) {
        float x = mod(i,${sx})*${isx}-1.0;
        float y = mod(i/${sx},${sy})*${isy}-1.0;
        float z = mod(i*${isxy},${sz})*${isz}-1.0;
        return clamp(0.5+surface(vec3(x,y,z)),0.0,1.0);
      }
      void main () {
        float i = (gl_FragCoord.x+gl_FragCoord.y*${st(sq)})*4.0
          + ${st(magic[size]||0)};
        gl_FragColor = vec4(
          isurface(i+0.0),
          isurface(i+1.0),
          isurface(i+2.0),
          isurface(i+3.0)
        );
      }
    `,
    vert: `
      attribute vec2 position;
      void main () {
        gl_Position = vec4(position,0,1);
      }
    `,
    attributes: {
      position: [-4,4,4,4,0,-4]
    },
    count: 3,
    depth: {
      enable: false
    }
  })
  regl.clear({ color: [0,0,0,1], depth: true })
  var fb = regl.framebuffer({
    width: sq,
    height: sq,
    colorFormat: 'rgba',
    colorType: 'uint8'
  })
  var mesh
  draw({ framebuffer: fb }, function () {
    regl.draw()
    var data = regl.read()
    var iv = 1/127.5
    var ndata = new Float32Array(len)
    for (var i = 0; i < data.length; i++) {
      ndata[i] = (data[i] - 127.5) * iv
    }
    mesh = scale(size, surfaceNets(ndarray(ndata,size)))
  })
  return mesh
}

function st (n) {
  return String(n).replace(/^(\d+)$/, '$1.0')
}
