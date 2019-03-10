const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );

const up = new THREE.Vector3(0, 1, 0);
let spline = createTrackSpline(up);
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


const lane = { width: 6, offset: 0, id: 0 };
const lanePoints = makeLane(lane, spline);
const geometry = createGeometry(lanePoints);
const trackObject = createMesh(geometry, 'assets/tarmac_road.jpg');
scene.add( trackObject );

const laneGrass = {width: 5, offset: 5.5, id: 1 };
const lanePointsGrass = makeLane(laneGrass, spline);
const geometryGrass = createGeometry(lanePointsGrass);
const grassObject = createMesh(geometryGrass, 'assets/grass.jpg');
scene.add( grassObject );


const laneGrass2 = {width: 5, offset: -5.5, id: 1 };
const lanePointsGrass2 = makeLane(laneGrass2, spline);
const geometryGrass2 = createGeometry(lanePointsGrass2);
const grassObject2 = createMesh(geometryGrass2, 'assets/grass.jpg');
scene.add( grassObject2 );

const meshes = [ trackObject, grassObject, grassObject2 ];


function makeLane(lane, spline) {
    const leftOffset = -(lane.width * 0.5) + lane.offset;
    const rightOffset = (lane.width * 0.5) + lane.offset;
    const lanePoints = spline.map(pose => {
        const leftVector = pose.right.clone().multiplyScalar(leftOffset);
        const rightVector = pose.right.clone().multiplyScalar(rightOffset);
        return [pose.position.clone().add(leftVector), pose.position.clone().add(rightVector)]; // TODO: add camber
    });
    return lanePoints;
}

function createMesh(geometry, textureFileName) {
    const texture = new THREE.TextureLoader().load(textureFileName);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, map: texture });
    return new THREE.Mesh(geometry, material);    
}

function createGeometry(lanePoints) {    
    const geometry = new THREE.Geometry();
    const roadMetres = 20;
    const metresRoad = 1 / roadMetres;
    lanePoints.forEach(([l, r], i) => {
        geometry.vertices.push(l, r);
        if (i < lanePoints.length - 1) {
            const vertex = i * 2;
            geometry.faces.push(new THREE.Face3(vertex, vertex + 2, vertex + 1));
            geometry.faces.push(new THREE.Face3(vertex + 1, vertex + 2, vertex + 3));
            const textureIncrement = (i % roadMetres) / roadMetres;
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(1, textureIncrement),
                new THREE.Vector2(1, textureIncrement + metresRoad),
                new THREE.Vector2(0, textureIncrement + metresRoad),
            ]);
            geometry.faceVertexUvs[0].push([
                new THREE.Vector2(0, textureIncrement),
                new THREE.Vector2(1, textureIncrement),
                new THREE.Vector2(0, textureIncrement + metresRoad),
            ]);
        }
    });
    
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    return geometry;
}

const gravity = up.clone().multiplyScalar(-9.8);

function createTrackSpline(up) {
    const sl = 1;
    const straight = (length) => (startPose) => {
        let pose = startPose;
        const poses = [];
        for (i = 0; i < length; i++) {
            poses.push(pose);
            const rise = (i > 100 && i < 110) ? 0.1 : 0;            
            pose = {
                position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl).add(up.clone().multiplyScalar(rise))),
                direction: pose.direction
            };
        }
        return poses;
    };
    const curve = (radius, angle) => (startPose) => {
        const alpha = Math.atan(sl / radius);
        const length = 2 * Math.PI * Math.abs(radius) * (angle / 360);
        let pose = startPose;
        const poses = [];
        for (i = 0; i < length; i++) {
            pose = {
                position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl)),
                direction: pose.direction.clone().applyAxisAngle(up, alpha)
            };
            poses.push(pose);
        }
        return poses;
    };
    const track = [
        straight(213),
        curve(100, 225),
        straight(80),
        curve(-30, 135),
        curve(30, 135),
        straight(50),
        curve(72, 135)
    ]; // TODO: make it join up
    const spline = [{
        position: new THREE.Vector3(0, 1, 0),
        direction: new THREE.Vector3(1, 0, 0)
    }];
    track.forEach(segment => {
        spline.push(...segment(spline[spline.length - 1]));
    });
    return spline;
}

// const speedUp = 1;

const car = new Car({  // RX-7
    mass: 1250,
    cgPosition: [0, 20, 0],  //cm
    yawInertia: 2000,  // Kg m2
    rollInertia: 400,
    pitchInertia: 1500
}, {
    wheelbase: 280,   //cm
    track: 160,
    steeringLock: 45  // degrees
}, {
    // FL, FR, RL, RR
    wheelRates: [3500, 3500, 3500, 3500],   //??
    totalTravel: [20, 20, 20, 20],  // cm
    damperRates: [2000, 2000, 2000, 2000]  //??
}, {
    maxTorque: 800,
    maxBrakeTorque: 1000
}, {
    position: new THREE.Vector3(10, 2, 0),  //m
    direction: new THREE.Vector3(1, 0, 0),
    up: up
});

function startGraphics() {
    document.body.appendChild( renderer.domElement );
    animate();
}

const height = 2;
let index = 0;
let oldIndex = wrap(-1);

function updateCamera() {
    const cameraPose = car.getCameraPose();
    const newPosition = cameraPose.position;
    camera.position.x = newPosition.x
    camera.position.y = newPosition.y
    camera.position.z = newPosition.z
    camera.lookAt(newPosition.clone().add(cameraPose.direction))
    camera.updateMatrixWorld();
}
const frameInterval = 20;  //ms
let frameCounter = 0;

function animate() {
    setTimeout( animate , frameInterval);
    frameCounter++;
    car.update(frameInterval, meshes);
    updateCamera();
	renderer.render( scene, camera );
}

