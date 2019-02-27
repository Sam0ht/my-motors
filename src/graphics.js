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
    console.log("Alpha", alpha)
    let pose = startPose;
    const poses = [];
    for (i = 0; i < length; i++) {
        poses.push(pose);
        pose = {
            position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl)),
            direction: pose.direction.clone().applyAxisAngle(up, alpha)
        }
    }
    return poses;
}


const track = [
    straight(215),
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

const spline = [pose];
track.forEach(segment => {
    spline.push(...segment(spline[spline.length - 1]))
})
console.log(spline[spline.length - 1].position);
window.spline = spline;

const geometry = new THREE.Geometry();

geometry.vertices.push(
	new THREE.Vector3( -10,  10, 0 ),
	new THREE.Vector3( -10, -10, 0 ),
	new THREE.Vector3(  10, -10, 0 )
);

geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );


const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( geometry, material );
scene.add( cube );

camera.position.z = 5;

function startGraphics() {
    document.body.appendChild( renderer.domElement );
    animate();
}

function animate() {
    requestAnimationFrame( animate );
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
	renderer.render( scene, camera );
}
