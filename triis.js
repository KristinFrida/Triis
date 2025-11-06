"use strict";

var canvas;
var gl;
var program;

var W = 6;
var D = 6;
var H = 20;

var centerX = (W - 1) / 2.0;
var centerY = (H - 1) / 2.0;
var centerZ = (D - 1) / 2.0;

var universe = [];

var currentTetrisPiece = null;

var dropInterval = 500;
var lastDropTime = 0;

var angleX = 0;
var angleY = 0;
var dragging = false;
var lastMouseX = 0;
var lastMouseY = 0;

var points = [];
var colors = [];
var vBuffer;
var cBuffer;

var linePoints = [];
var lineColors = [];
var lineBuffer;
var lineColorBuffer;

var vPositionLoc;
var vColorLoc;
var modelViewMatrixLoc;
var projectionMatrixLoc;

var modelViewMatrix;
var projectionMatrix;

var score = 0;

var cubeVertices = [
  vec4(-0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, 0.5, 0.5, 1.0),
  vec4(0.5, 0.5, 0.5, 1.0),
  vec4(0.5, -0.5, 0.5, 1.0),
  vec4(-0.5, -0.5, -0.5, 1.0),
  vec4(-0.5, 0.5, -0.5, 1.0),
  vec4(0.5, 0.5, -0.5, 1.0),
  vec4(0.5, -0.5, -0.5, 1.0),
];

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) {
    alert("WebGL isn't available");
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  gl.clearColor(0.0, 0.0, 0.2, 1.0);

  program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  vBuffer = gl.createBuffer();
  cBuffer = gl.createBuffer();
  lineBuffer = gl.createBuffer();
  lineColorBuffer = gl.createBuffer();

  vPositionLoc = gl.getAttribLocation(program, "vPosition");
  vColorLoc = gl.getAttribLocation(program, "vColor");

  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

  projectionMatrix = perspective(
    45.0,
    canvas.width / canvas.height,
    0.1,
    100.0
  );
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  initUniverse();
  newTetrisPiece();
  initInput();

  requestAnimFrame(render);
};

function initUniverse() {
  universe = [];
  for (var x = 0; x < W; x++) {
    universe[x] = [];
    for (var y = 0; y < H; y++) {
      universe[x][y] = [];
      for (var z = 0; z < D; z++) {
        universe[x][y][z] = 0;
      }
    }
  }
}

function newTetrisPiece() {
  var t = Math.random() < 0.5 ? 0 : 1;
  var rel;
  var colour;
  var pieceType;

  if (t === 0) {
    rel = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: -2, z: 0 },
    ];
    colour = vec4(0.0, 0.9, 0.9, 0.2);
    pieceType = 1;
  } else {
    rel = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 1, y: -1, z: 0 },
    ];
    colour = vec4(1.0, 0.6, 0.2, 0.2);
    pieceType = 2;
  }

  currentTetrisPiece = {
    pos: { x: 2, y: H - 1, z: 2 },
    rel: rel,
    color: colour,
    type: pieceType,
  };

  if (!validPosition(currentTetrisPiece.pos, currentTetrisPiece.rel)) {
    alert("Leik lokið");
    initUniverse();
    score = 0;
    updatePoints();
    newTetrisPiece();
  }
}

function validPosition(pos, rel) {
  for (var i = 0; i < rel.length; i++) {
    var wx = pos.x + rel[i].x;
    var wy = pos.y + rel[i].y;
    var wz = pos.z + rel[i].z;

    if (wx < 0 || wx >= W || wy < 0 || wy >= H || wz < 0 || wz >= D) {
      return false;
    }
    if (universe[wx][wy][wz] !== 0) {
      return false;
    }
  }
  return true;
}

function tryMove(dx, dy, dz) {
  var newPos = {
    x: currentTetrisPiece.pos.x + dx,
    y: currentTetrisPiece.pos.y + dy,
    z: currentTetrisPiece.pos.z + dz,
  };
  if (validPosition(newPos, currentTetrisPiece.rel)) {
    currentTetrisPiece.pos = newPos;
    return true;
  }
  return false;
}

function moveDown() {
  if (!tryMove(0, -1, 0)) {
    placeTetrisPiece();
    clearFullLayers();
    newTetrisPiece();
  }
}

function hardDrop() {
  while (tryMove(0, -1, 0)) {}
  placeTetrisPiece();
  clearFullLayers();
  newTetrisPiece();
}

function placeTetrisPiece() {
  for (var i = 0; i < currentTetrisPiece.rel.length; i++) {
    var wx = currentTetrisPiece.pos.x + currentTetrisPiece.rel[i].x;
    var wy = currentTetrisPiece.pos.y + currentTetrisPiece.rel[i].y;
    var wz = currentTetrisPiece.pos.z + currentTetrisPiece.rel[i].z;
    if (wx >= 0 && wx < W && wy >= 0 && wy < H && wz >= 0 && wz < D) {
      universe[wx][wy][wz] = currentTetrisPiece.type;
    }
  }
}

function clearFullLayers() {
  var cleared = 0;
  for (var y = 0; y < H; y++) {
    var full = true;
    for (var x = 0; x < W && full; x++) {
      for (var z = 0; z < D; z++) {
        if (universe[x][y][z] === 0) {
          full = false;
          break;
        }
      }
    }
    if (full) {
      cleared++;
      for (var yy = y; yy < H - 1; yy++) {
        for (var x2 = 0; x2 < W; x2++) {
          for (var z2 = 0; z2 < D; z2++) {
            universe[x2][yy][z2] = universe[x2][yy + 1][z2];
          }
        }
      }
      for (var x3 = 0; x3 < W; x3++) {
        for (var z3 = 0; z3 < D; z3++) {
          universe[x3][H - 1][z3] = 0;
        }
      }
      y--;
    }
  }

  if (cleared > 0) {
    score += cleared * 100;
    updatePoints();
  }
}

function updatePoints() {
  var el = document.getElementById("score");
  if (el) {
    el.innerHTML = "Stigagjöf: " + score;
  }
}

function rotateVec(v, axis, dir) {
  var x = v.x,
    y = v.y,
    z = v.z;
  if (axis === "x") {
    if (dir > 0) {
      return { x: x, y: -z, z: y };
    } else {
      return { x: x, y: z, z: -y };
    }
  } else if (axis === "y") {
    if (dir > 0) {
      return { x: z, y: y, z: -x };
    } else {
      return { x: -z, y: y, z: x };
    }
  } else {
    if (dir > 0) {
      return { x: -y, y: x, z: z };
    } else {
      return { x: y, y: -x, z: z };
    }
  }
}

function rotateTetrisPiece(axis, dir) {
  var oldRel = [];
  for (var i = 0; i < currentTetrisPiece.rel.length; i++) {
    oldRel.push({
      x: currentTetrisPiece.rel[i].x,
      y: currentTetrisPiece.rel[i].y,
      z: currentTetrisPiece.rel[i].z,
    });
  }

  for (var j = 0; j < currentTetrisPiece.rel.length; j++) {
    currentTetrisPiece.rel[j] = rotateVec(currentTetrisPiece.rel[j], axis, dir);
  }

  if (!validPosition(currentTetrisPiece.pos, currentTetrisPiece.rel)) {
    currentTetrisPiece.rel = oldRel;
  }
}

function quad(a, b, c, d, color, x, y, z) {
  var indices = [a, b, c, a, c, d];
  for (var i = 0; i < indices.length; i++) {
    var v = cubeVertices[indices[i]];
    points.push(vec4(v[0] + x, v[1] + y, v[2] + z, 1.0));
    colors.push(color);
  }
}

function addCube(ix, iy, iz, color) {
  var x = ix - centerX;
  var y = iy - centerY;
  var z = iz - centerZ;

  quad(1, 0, 3, 2, color, x, y, z);
  quad(2, 3, 7, 6, color, x, y, z);
  quad(3, 0, 4, 7, color, x, y, z);
  quad(6, 5, 1, 2, color, x, y, z);
  quad(4, 5, 6, 7, color, x, y, z);
  quad(5, 4, 0, 1, color, x, y, z);
}

function addCubeEdges(ix, iy, iz, color) {
  var x = ix - centerX;
  var y = iy - centerY;
  var z = iz - centerZ;

  function edge(i, j) {
    var v1 = cubeVertices[i];
    var v2 = cubeVertices[j];
    linePoints.push(vec4(v1[0] + x, v1[1] + y, v1[2] + z, 1.0));
    linePoints.push(vec4(v2[0] + x, v2[1] + y, v2[2] + z, 1.0));
    lineColors.push(color);
    lineColors.push(color);
  }

  edge(0, 1);
  edge(1, 2);
  edge(2, 3);
  edge(3, 0);
  edge(4, 5);
  edge(5, 6);
  edge(6, 7);
  edge(7, 4);
  edge(0, 4);
  edge(1, 5);
  edge(2, 6);
  edge(3, 7);
}

function addBase() {
  var floorColor = vec4(0.9, 0.9, 0.9, 1.0);
  var y = -1.0;
  for (var x = 0; x < W; x++) {
    for (var z = 0; z < D; z++) {
      addCube(x, y, z, floorColor);
    }
  }
}

function addBaseLines() {
  var cellMinX = -centerX - 0.5;
  var cellMaxX = centerX + 0.5;
  var cellMinZ = -centerZ - 0.5;
  var cellMaxZ = centerZ + 0.5;

  var BaseUniverseY = -1.0;
  var floorY = BaseUniverseY - centerY + 0.51;

  var c = vec4(0.0, 0.0, 0.0, 1.0);

  function addLine(p1, p2) {
    linePoints.push(p1);
    linePoints.push(p2);
    lineColors.push(c);
    lineColors.push(c);
  }

  for (var i = 1; i < W; i++) {
    var x = cellMinX + i;
    addLine(vec4(x, floorY, cellMinZ, 1.0), vec4(x, floorY, cellMaxZ, 1.0));
  }

  for (var j = 1; j < D; j++) {
    var z = cellMinZ + j;
    addLine(vec4(cellMinX, floorY, z, 1.0), vec4(cellMaxX, floorY, z, 1.0));
  }
}

function addBoxLines() {
  var minX = -centerX - 0.5;
  var maxX = centerX + 0.5;
  var minY = -centerY - 0.5;
  var maxY = centerY + 0.5;
  var minZ = -centerZ - 0.5;
  var maxZ = centerZ + 0.5;

  var boxColor = vec4(1.0, 1.0, 1.0, 0.3);

  function addLine(p1, p2, color) {
    linePoints.push(p1);
    linePoints.push(p2);
    lineColors.push(color);
    lineColors.push(color);
  }

  addLine(vec4(minX, minY, minZ, 1.0), vec4(maxX, minY, minZ, 1.0), boxColor);
  addLine(vec4(maxX, minY, minZ, 1.0), vec4(maxX, minY, maxZ, 1.0), boxColor);
  addLine(vec4(maxX, minY, maxZ, 1.0), vec4(minX, minY, maxZ, 1.0), boxColor);
  addLine(vec4(minX, minY, maxZ, 1.0), vec4(minX, minY, minZ, 1.0), boxColor);

  addLine(vec4(minX, maxY, minZ, 1.0), vec4(maxX, maxY, minZ, 1.0), boxColor);
  addLine(vec4(maxX, maxY, minZ, 1.0), vec4(maxX, maxY, maxZ, 1.0), boxColor);
  addLine(vec4(maxX, maxY, maxZ, 1.0), vec4(minX, maxY, maxZ, 1.0), boxColor);
  addLine(vec4(minX, maxY, maxZ, 1.0), vec4(minX, maxY, minZ, 1.0), boxColor);

  addLine(vec4(minX, minY, minZ, 1.0), vec4(minX, maxY, minZ, 1.0), boxColor);
  addLine(vec4(maxX, minY, minZ, 1.0), vec4(maxX, maxY, minZ, 1.0), boxColor);
  addLine(vec4(maxX, minY, maxZ, 1.0), vec4(maxX, maxY, maxZ, 1.0), boxColor);
  addLine(vec4(minX, minY, maxZ, 1.0), vec4(minX, maxY, maxZ, 1.0), boxColor);
}

function updateGeometry() {
  points = [];
  colors = [];
  linePoints = [];
  lineColors = [];

  var settledColor1 = vec4(0.0, 0.5, 0.5, 0.8);
  var settledColor2 = vec4(0.7, 0.3, 0.0, 0.8);
  var defaultPieceColor = vec4(1.0, 0.2, 0.6, 0.95);
  var pieceColor = currentTetrisPiece
    ? currentTetrisPiece.color
    : defaultPieceColor;

  for (var x = 0; x < W; x++) {
    for (var y = 0; y < H; y++) {
      for (var z = 0; z < D; z++) {
        if (universe[x][y][z] === 1) {
          addCube(x, y, z, settledColor1);
          addCubeEdges(x, y, z, vec4(0.0, 0.0, 0.0, 1.0));
        } else if (universe[x][y][z] === 2) {
          addCube(x, y, z, settledColor2);
          addCubeEdges(x, y, z, vec4(0.0, 0.0, 0.0, 1.0));
        }
      }
    }
  }

  if (currentTetrisPiece) {
    for (var i = 0; i < currentTetrisPiece.rel.length; i++) {
      var wx = currentTetrisPiece.pos.x + currentTetrisPiece.rel[i].x;
      var wy = currentTetrisPiece.pos.y + currentTetrisPiece.rel[i].y;
      var wz = currentTetrisPiece.pos.z + currentTetrisPiece.rel[i].z;
      if (wx >= 0 && wx < W && wy >= 0 && wy < H && wz >= 0 && wz < D) {
        addCube(wx, wy, wz, pieceColor);
        addCubeEdges(wx, wy, wz, vec4(0.0, 0.0, 0.0, 1.0));
      }
    }
  }

  addBase();
  addBoxLines();
  addBaseLines();

  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
  gl.vertexAttribPointer(vPositionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPositionLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
  gl.vertexAttribPointer(vColorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vColorLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(linePoints), gl.STATIC_DRAW);
  gl.vertexAttribPointer(vPositionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPositionLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(lineColors), gl.STATIC_DRAW);
  gl.vertexAttribPointer(vColorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vColorLoc);
}

function render(time) {
  if (!time) time = 0;

  if (time - lastDropTime > dropInterval) {
    moveDown();
    lastDropTime = time;
  }

  updateGeometry();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var rx = rotate(angleX, [1, 0, 0]);
  var ry = rotate(angleY, [0, 1, 0]);
  var rot = mult(rx, ry);
  var trans = translate(0.0, 0.0, -40.0);
  modelViewMatrix = mult(trans, rot);

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.vertexAttribPointer(vPositionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPositionLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.vertexAttribPointer(vColorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vColorLoc);

  gl.drawArrays(gl.TRIANGLES, 0, points.length);

  gl.lineWidth(8.0);

  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
  gl.vertexAttribPointer(vPositionLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPositionLoc);

  gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
  gl.vertexAttribPointer(vColorLoc, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vColorLoc);

  gl.drawArrays(gl.LINES, 0, linePoints.length);

  requestAnimFrame(render);
}

function initInput() {
  window.addEventListener("keydown", function (e) {
    var k = e.key;
    switch (k) {
      case "ArrowLeft":
        e.preventDefault();
        tryMove(-1, 0, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        tryMove(1, 0, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        tryMove(0, 0, -1);
        break;
      case "ArrowDown":
        e.preventDefault();
        tryMove(0, 0, 1);
        break;
      case "a":
      case "A":
        rotateTetrisPiece("x", 1);
        break;
      case "z":
      case "Z":
        rotateTetrisPiece("x", -1);
        break;
      case "s":
      case "S":
        rotateTetrisPiece("y", 1);
        break;
      case "x":
      case "X":
        rotateTetrisPiece("y", -1);
        break;
      case "d":
      case "D":
        rotateTetrisPiece("z", 1);
        break;
      case "c":
      case "C":
        rotateTetrisPiece("z", -1);
        break;
      default:
        if (k === " " || e.code === "Space") {
          e.preventDefault();
          hardDrop();
        }
        break;
    }
  });

  canvas.addEventListener("mousedown", function (e) {
    dragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("mouseup", function () {
    dragging = false;
  });

  canvas.addEventListener("mouseleave", function () {
    dragging = false;
  });

  canvas.addEventListener("mousemove", function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastMouseX;
    var dy = e.clientY - lastMouseY;
    angleY += dx * 0.5;
    angleX += dy * 0.5;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });
}
