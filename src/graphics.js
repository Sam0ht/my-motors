
const texture = new THREE.TextureLoader().load( 'assets/tarmac.jpg' );

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );


// const geometry = new THREE.BoxGeometry( 1, 1, 1 );

const sl = 1;

const up = new THREE.Vector3(0, 1, 0);

const straight = (length) => (startPose) => {
    let pose = startPose;
    const poses = [];
    for (i = 0; i < length; i++) {
        poses.push(pose);
        pose = {
            position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl)),
            direction: pose.direction
        }
    }
    return poses;
}

const curve = (radius, angle) => (startPose) => {
    const alpha = Math.atan(sl / radius);
    const length = 2 * Math.PI * Math.abs(radius) * (angle / 360)
    let pose = startPose;
    const poses = [];
    for (i = 0; i < length; i++) {
        pose = {
            position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl)),
            direction: pose.direction.clone().applyAxisAngle(up, alpha)
        }
        poses.push(pose);
    }
    return poses;
}

const track = [
    straight(213),
    curve(100, 225),
    straight(80),
    curve(-30, 135),
    curve(30, 135),
    straight(50),
    curve(72, 135)
];  // TODO: make it join up

let pose = {
    position: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(1, 0, 0)
}

let spline = [pose];
track.forEach(segment => {
    spline.push(...segment(spline[spline.length - 1]))
})
console.log(spline[spline.length - 1].position);

const wrap = (index) => {
    if (index < 0) {
        index += spline.length;
    }
    if (index >= spline.length) {
        index -= spline.length;
    }
    return index;
}

spline = spline.map((pose, i) => {
    const prev = wrap(i - 1);
    const next = wrap(i + 1);
    const movement = spline[next].position.clone().sub(spline[prev].position).normalize();
    const right = up.clone().cross(movement);
    return {...pose, movement: movement, right: right};
});

window.spline = spline;
console.log(spline[spline.length - 1]);

const lane = { width: 6, offset: 0, id: 0 };


const leftOffset = -(lane.width * 0.5) - lane.offset;
const rightOffset = (lane.width * 0.5) + lane.offset;
const lanePoints = spline.map(pose => {
    const leftVector = pose.right.clone().multiplyScalar(leftOffset);
    const rightVector = pose.right.clone().multiplyScalar(rightOffset);
    return [pose.position.clone().add(leftVector),  pose.position.clone().add(rightVector)];  // TODO: add camber
});


const geometry = new THREE.Geometry();

// geometry.faceVertexUvs[0] = [];

lanePoints.forEach(([l, r], i) => {
    geometry.vertices.push(
        l, r
    );
    if (i < lanePoints.length - 1) {
        const vertex = i * 2
        geometry.faces.push( new THREE.Face3( vertex, vertex + 2, vertex + 1 ) );
        geometry.faces.push( new THREE.Face3( vertex + 1, vertex + 2, vertex + 3 ) );

        // geometry.faceVertexUvs[0].push([
        //     new THREE.Vector2(0,0),        //play with these values
        //     new THREE.Vector2(0,1),
        //     new THREE.Vector2(1,0)
        // ]);
        // geometry.faceVertexUvs[0].push([
        //     new THREE.Vector2(1,0),        //play with these values
        //     new THREE.Vector2(1,1),
        //     new THREE.Vector2(0,1)
        // ]);

    }
});


// geometry.uvsNeedUpdate = true;

geometry.computeBoundingBox();

var max = geometry.boundingBox.max,
    min = geometry.boundingBox.min;
var offset = new THREE.Vector2(0 - min.x, 0 - min.z);
var range = new THREE.Vector2(max.x - min.x, max.z - min.z);
const scale = 5;
range.multiplyScalar(scale);
var faces = geometry.faces;
console.log("BBox:", max, min);
console.log("offset", offset);
console.log("range", range);
geometry.faceVertexUvs[0] = [];

for (var i = 0; i < faces.length ; i++) {

    var v1 = geometry.vertices[faces[i].a], 
        v2 = geometry.vertices[faces[i].b], 
        v3 = geometry.vertices[faces[i].c];

    geometry.faceVertexUvs[0].push([
        new THREE.Vector2((v1.x + offset.x)/range.x ,(v1.z + offset.y)/range.y),
        new THREE.Vector2((v2.x + offset.x)/range.x ,(v2.z + offset.y)/range.y),
        new THREE.Vector2((v3.x + offset.x)/range.x ,(v3.z + offset.y)/range.y)
    ]);
}
geometry.uvsNeedUpdate = true;

geometry.computeFaceNormals();
geometry.computeVertexNormals();

texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
texture.repeat.set( 1024, 1024 );


const material = new THREE.MeshBasicMaterial( { color: 0xffffff, map: texture } );


console.log(geometry.faceVertexUvs[0]);
window.geometry = geometry;

const trackObject = new THREE.Mesh( geometry, material );
scene.add( trackObject );

camera.position.y = 200;
camera.lookAt(new THREE.Vector3(0, 0, 0))
camera.updateMatrixWorld();

function startGraphics() {
    document.body.appendChild( renderer.domElement );
    animate();
}

const height = 2;
let index = 0;

function updateCamera() {
    index = wrap(index + 1);
    const cameraPose = spline[index];
    const newPosition = cameraPose.position.clone().add(up.clone().multiplyScalar(height));
    camera.position.x = newPosition.x
    camera.position.y = newPosition.y
    camera.position.z = newPosition.z
    camera.lookAt(newPosition.clone().add(cameraPose.direction))
    camera.updateMatrixWorld();
}

function animate() {
    requestAnimationFrame( animate );
    // cube.rotation.x += 0.01;
    // trackObject.rotation.y += 0.01;
    updateCamera();
	renderer.render( scene, camera );
}

