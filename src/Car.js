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
        this.rearWheelbase = chassis.wheelbase / 200; // cm > M, half because CG in centre of car
        this.cameraHeight = 1;
        this.cameraBehind = 0;
        this.yawRate = 0;
        this.tyreGrip = 1; // 1G grip
        this.tyreSharpness = 2000; // N / radian / m/s  (?)
        const offsets = [this.frontWheelbase, -this.rearWheelbase];
        this.wheels = [];
        for (let i = 0; i < 4; i++) {
            this.wheels.push(new Wheel(this, i, offsets[Math.floor(i / 2)], chassis.track / 200 * (i % 2 == 0 ? -1 : 1)));
        }
        console.log(this.wheels);
    }
    ;
    getCameraPose() {
        return {
            position: this.pose.position.clone().sub(this.pose.direction.clone().multiplyScalar(this.cameraBehind)).add(this.pose.up.clone().multiplyScalar(this.cameraHeight)),
            direction: this.pose.direction
        };
    }
    ;
    damperForce(wheelIndex) {
        const verticalWheelRate = this.velocity.y; //TODO: big simplification
        const damperForce = this.suspension.damperRates[wheelIndex] * verticalWheelRate * -2;
        return this.pose.up.clone().multiplyScalar(damperForce);
    }
    heightAboveGround(springIndex, meshes) {
        const wheelIndex = springIndex * 2;
        const wheels = this.wheels.slice(wheelIndex, wheelIndex + 1);
        const rays = wheels.map(wheel => wheel.getRay());
        const intersections = rays.map(ray => meshes.map(mesh => ray.intersectObject(mesh))).flat(99);
        const distances = intersections.map(i => i.distance);
        return (distances.reduce((a, b) => a + b, 0) / distances.length) - 1; // Ray starts from 1m above the 'wheel' position to avoid falling through
    }
    springForce(springIndex, meshes) {
        const totalTravel = this.suspension.totalTravel[springIndex] * 0.01; // cm -> m        
        const displacement = totalTravel - this.heightAboveGround(springIndex, meshes);
        if (displacement < 0) {
            return [new THREE.Vector3(0, 0, 0), displacement];
        }
        const springRate = this.suspension.wheelRates[springIndex] * 10; // kg/cm -> N/m
        const totalVerticalForce = displacement * springRate * 2; // two front wheels
        const totalForce = this.pose.up.clone().multiplyScalar(totalVerticalForce);
        return [totalForce, displacement];
    }
    tractionForce(throttleInput, wheelLoading) {
        const appliedTorque = throttleInput * this.engine.maxTorque;
        const availableTraction = wheelLoading.y * this.tyreGrip; // TODO: use of wheelLoading.y for vertical load?
        const driveForce = Math.min(appliedTorque, availableTraction);
        return this.pose.direction.clone().multiplyScalar(driveForce);
    }
    brakingForce(brakeInput, wheelLoading) {
        // TODO: direction depends on velocity = -ve if direction matches vel, +ve otherwise.
        const appliedTorque = brakeInput * this.engine.maxBrakeTorque;
        const availableTraction = wheelLoading.y * this.tyreGrip; // TODO: use of wheelLoading.y for vertical load?
        const brakeForce = Math.min(appliedTorque, availableTraction);
        return this.pose.direction.clone().multiplyScalar(-brakeForce);
    }
    rightVector() {
        return this.pose.direction.clone().cross(this.pose.up);
    }
    lateralForce(slipAngle, speed, wheelLoading) {
        const slipForce = slipAngle * speed * this.tyreSharpness;
        const availableTraction = wheelLoading.y * this.tyreGrip; // TODO: use of wheelLoading.y for vertical load?
        const lateralForce = Math.min(slipForce, availableTraction);
        return [this.rightVector().multiplyScalar(-lateralForce), slipForce > availableTraction];
    }
    angleFrom(v1, v2) {
        const angle = v1.angleTo(v2);
        const cross = v1.clone().cross(v2);
        const polarity = Math.sign(this.pose.up.clone().dot(cross));
        return angle * polarity; // angleTo is absolute, doesn't include direction (sigh)
    }
    controlCurve(steeringInput) {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5);
        return positiveInput * Math.sign(steeringInput);
    }
    update(frameInterval, meshes) {
        const time = frameInterval * 0.001 * speedUp;

        const force = new THREE.Vector3(0, 0, 0);
        force.add(this.weight);
        
        //front
        const [frontSpringForce, frontDisplacement] = this.springForce(0, meshes);
        let frontWheelLoading = new THREE.Vector3(0, 0, 0);
        if (frontDisplacement > 0) {
            const frontDampingForce = this.damperForce(0);
            frontWheelLoading = frontSpringForce.clone().add(frontDampingForce);
            force.add(frontWheelLoading);
            // console.log("front wheel loading", frontWheelLoading)
        }
        //rear        
        const [rearSpringForce, rearDisplacement] = this.springForce(1, meshes);
        let rearWheelLoading = new THREE.Vector3(0, 0, 0);
        if (rearDisplacement > 0) {
            const rearDamperForce = this.damperForce(1);
            rearWheelLoading = rearSpringForce.clone().add(rearDamperForce);
            force.add(rearWheelLoading);
            // console.log("rear wheel loading", rearWheelLoading)
        }
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
        const spinVelocityFront = -this.frontWheelbase * this.yawRate;
        const frontWheelVelocity = this.velocity.clone().add(this.rightVector().multiplyScalar(spinVelocityFront));
        const slipAngleFront = this.angleFrom(frontWheelVelocity, this.pose.direction);
        // rear wheels
        const spinVelocityRear = this.rearWheelbase * this.yawRate;
        const rearWheelVelocity = this.velocity.clone().add(this.rightVector().multiplyScalar(spinVelocityRear));
        const slipAngleRear = this.angleFrom(rearWheelVelocity, this.pose.direction);
        const [lateralForceRear, slideRear] = this.lateralForce(slipAngleRear, rearWheelVelocity.length(), rearWheelLoading);
        force.add(lateralForceRear);
        // console.log("slip angles", slipAngleFront, slipAngleRear, "rear lat force", lateralForceRear);
        // front wheels
        const steeringInput = this.controlCurve(gamepad.axes[2]);
        const steeringAngle = -(steeringInput) * this.maxSteeringLockRadians; // cube to make -1..1 range input softer around centre
        const [lateralForceFront, slideFront] = this.lateralForce(slipAngleFront + steeringAngle, frontWheelVelocity.length(), frontWheelLoading);
        force.add(lateralForceFront);
        // console.log("input", steeringInput, "angle", steeringAngle, "lat force front", lateralForceFront);
        // Yaw Torque
        const right = this.rightVector();
        const yawTorque = (lateralForceRear.dot(right) * this.rearWheelbase) - lateralForceFront.dot(right) * this.frontWheelbase; // 1.1 for stability
        this.yawRate += (time * 0.2 * yawTorque / this.mass.inertia); // 0.2 to slow down rotation wrt lateral grip
        const yaw = this.yawRate * time;
        this.pose.direction.applyAxisAngle(this.pose.up, yaw);
        // console.log("yaw torque", yawTorque, "yaw rate", this.yawRate, "yaw", yaw, "direction", this.pose.direction);
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
