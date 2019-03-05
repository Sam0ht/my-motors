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
            pose = {
                position: pose.position.clone().add(pose.direction.clone().multiplyScalar(sl)),
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
        position: new THREE.Vector3(0, 0, 0),
        direction: new THREE.Vector3(1, 0, 0)
    }];
    track.forEach(segment => {
        spline.push(...segment(spline[spline.length - 1]));
    });
    return spline;
}

const speedUp = 1;

class Car {

    constructor(mass, chassis, suspension, engine, initialPose) {
        this.pose = initialPose;
        this.velocity = this.pose.direction.clone().multiplyScalar(0.1); //new THREE.Vector3(0, 0, 0);
        this.mass = mass;
        this.weight = gravity.clone().multiplyScalar(this.mass.mass);
        this.lightness = 1 / this.mass.mass;
        this.chassisDimensions = chassis;
        this.suspension = suspension;
        this.engine = engine;
        this.maxSteeringLockRadians = chassis.steeringLock * Math.PI / 180;
        this.frontWheelbase = chassis.wheelbase / 200;
        this.rearWheelbase = chassis.wheelbase / 200;  // cm > M, half because CG in centre of car
        
        this.cameraHeight = 1;
        this.cameraBehind = 0;
        this.yawRate = 0;

        this.tyreGrip = 1;  // 1G grip
        this.tyreSharpness = 2000;  // N / radian / m/s  (?)
    };

    getCameraPose() {
         return {
            position: this.pose.position.clone().sub(this.pose.direction.clone().multiplyScalar(this.cameraBehind)).add(this.pose.up.clone().multiplyScalar(this.cameraHeight)),
            direction: this.pose.direction
        }
    };

    damperForce(wheelIndex) {
        const totalTravel = this.suspension.totalTravel[wheelIndex] * 0.01;  // cm -> m
        const displacement = totalTravel - this.pose.position.y;  //TODO: redundant with spring calc
        if (displacement < 0) {
            return new THREE.Vector3(0, 0, 0);
        }
        const verticalWheelRate = this.velocity.y;  //TODO: big simplification
        const damperForce = this.suspension.damperRates[wheelIndex] * verticalWheelRate * -2;
        return this.pose.up.clone().multiplyScalar(damperForce);
    }

    springForce(springIndex) {
        const totalTravel = this.suspension.totalTravel[springIndex] * 0.01;  // cm -> m
        const displacement = totalTravel - this.pose.position.y;  // TODO: consider wheel position based on orientation, intersect ground plane
        if (displacement < 0) {
            return new THREE.Vector3(0, 0, 0);
        }
        const springRate = this.suspension.wheelRates[springIndex] * 10;  // kg/cm -> N/m
        const totalVerticalForce = displacement * springRate * 2;  // two front wheels
        const totalForce = this.pose.up.clone().multiplyScalar(totalVerticalForce);
        return totalForce;                    
    }


    tractionForce(throttleInput, wheelLoading) {
        const appliedTorque = throttleInput * this.engine.maxTorque;
        const availableTraction = wheelLoading.y * this.tyreGrip;  // TODO: use of wheelLoading.y for vertical load?
        const driveForce = Math.min(appliedTorque, availableTraction);
        return this.pose.direction.clone().multiplyScalar(driveForce);        
    }

    brakingForce(brakeInput, wheelLoading) {
        // TODO: direction depends on velocity = -ve if direction matches vel, +ve otherwise.
        const appliedTorque = brakeInput * this.engine.maxBrakeTorque;
        const availableTraction = wheelLoading.y * this.tyreGrip;  // TODO: use of wheelLoading.y for vertical load?
        const brakeForce = Math.min(appliedTorque, availableTraction);
        return this.pose.direction.clone().multiplyScalar(-brakeForce);     
    }

    rightVector() {
        return this.pose.direction.clone().cross(this.pose.up);
    }
    
    lateralForce(slipAngle, speed, wheelLoading) {        
        const slipForce = slipAngle * speed * this.tyreSharpness;
        const availableTraction = wheelLoading.y * this.tyreGrip;  // TODO: use of wheelLoading.y for vertical load?
        const lateralForce = Math.min(slipForce, availableTraction);
        return [this.rightVector().multiplyScalar(-lateralForce), slipForce > availableTraction];     
    }

    angleFrom(v1, v2) {
        const angle = v1.angleTo(v2);
        const cross = v1.clone().cross(v2);
        const polarity = Math.sign(this.pose.up.clone().dot(cross));
        return angle * polarity;  // angleTo is absolute, doesn't include direction (sigh)
    }

    controlCurve(steeringInput) {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5)
        return positiveInput * Math.sign(steeringInput);
    }

    update(frameInterval) {
        const time = frameInterval * 0.001 * speedUp;
        const force = new THREE.Vector3(0, 0, 0);
        force.add(this.weight);
        
        //front
        const frontSpringForce = this.springForce(0);
        const frontDampingForce = this.damperForce(0);
        const frontWheelLoading = frontSpringForce.clone().add(frontDampingForce);
        force.add(frontWheelLoading);

        //rear        
        const rearSpringForce = this.springForce(1);        
        const rearDamperForce = this.damperForce(1);
        const rearWheelLoading = rearSpringForce.clone().add(rearDamperForce);
        force.add(rearWheelLoading);

        const gamepad = navigator.getGamepads()[0];
        const throttleInput = gamepad.buttons[7].value;
        
        const tractionForce = this.tractionForce(throttleInput, rearWheelLoading);
        
        // console.log("Throttle input", throttleInput, "Tractive force", tractionForce);
        force.add(tractionForce);

        const brakeInput = gamepad.buttons[6].value;

        const brakingForceFront = this.brakingForce(brakeInput, frontWheelLoading);
        force.add(brakingForceFront);
        const brakingForceRear = this.brakingForce(brakeInput, rearWheelLoading);
        force.add(brakingForceRear);

        // lateral forces
        // if (this.velocity.length() > 0) {
            const spinVelocityFront = -this.frontWheelbase * this.yawRate;
            const frontWheelVelocity = this.velocity.clone().add(this.rightVector().multiplyScalar(spinVelocityFront));

            // let slipAngleFront = frontWheelVelocity.angleTo(this.pose.direction);
            // const cross = frontWheelVelocity.clone().cross(this.pose.direction);
            // const polarity = Math.sign(this.pose.up.clone().dot(cross));
            // slipAngleFront *= polarity;  // angleTo is absolute, doesn't include direction (sigh)
            const slipAngleFront = this.angleFrom(frontWheelVelocity, this.pose.direction);
            
            // rear wheels
            const spinVelocityRear = this.rearWheelbase * this.yawRate;
            const rearWheelVelocity = this.velocity.clone().add(this.rightVector().multiplyScalar(spinVelocityRear));
            const slipAngleRear = this.angleFrom(rearWheelVelocity, this.pose.direction);

            const [lateralForceRear, slideRear] = this.lateralForce(slipAngleRear, rearWheelVelocity.length(), rearWheelLoading);
            force.add(lateralForceRear)
            // console.log("slip angles", slipAngleFront, slipAngleRear, "rear lat force", lateralForceRear);

            // front wheels
            const steeringInput = this.controlCurve(gamepad.axes[2]);
            const steeringAngle = -(steeringInput) * this.maxSteeringLockRadians;  // cube to make -1..1 range input softer around centre
            const [lateralForceFront, slideFront] = this.lateralForce(slipAngleFront + steeringAngle, frontWheelVelocity.length(), frontWheelLoading);
            force.add(lateralForceFront);

            // console.log("input", steeringInput, "angle", steeringAngle, "lat force front", lateralForceFront);
            
            // Yaw Torque
            const right = this.rightVector();
            const yawTorque = (lateralForceRear.dot(right) * this.rearWheelbase) - lateralForceFront.dot(right) * this.frontWheelbase;          // 1.1 for stability
            this.yawRate += (time * 0.2 * yawTorque / this.mass.inertia);  // 0.2 to slow down rotation wrt lateral grip
            const yaw = this.yawRate * time;
            this.pose.direction.applyAxisAngle(this.pose.up, yaw);
            // console.log("yaw torque", yawTorque, "yaw rate", this.yawRate, "yaw", yaw, "direction", this.pose.direction);
        // } else {
        //     console.log("start driving to develop lateral forces", this.velocity)
        // }

        const acceleration = force.multiplyScalar(this.lightness);

        const dv = acceleration.multiplyScalar(time);
        this.velocity = this.velocity.clone().add(dv);

        this.pose.position.add(this.velocity.clone().multiplyScalar(time));

        if (frameCounter % 5 == 0) {
            if (slideFront || slideRear) {
                console.log("Speed", this.velocity.length(), "Slide front", slideFront, "Slide rear", slideRear);
            }
        }

    }
}

const car = new Car({  // RX-7
    mass: 1250,
    cgPosition: [0, 20, 0],  //cm
    inertia: 2000  // Kg m2
}, {
    wheelbase: 280,   //cm
    track: 160,
    steeringLock: 45  // degrees
}, {
    wheelRates: [3500, 3500],   //??
    totalTravel: [20, 20],  // cm
    damperRates: [2000, 2000]  //??
}, {
    maxTorque: 800,
    maxBrakeTorque: 1000
}, {
    position: new THREE.Vector3(10, 0.5, 0),  //m
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
    car.update(frameInterval);
    updateCamera();
	renderer.render( scene, camera );
}

