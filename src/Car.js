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
        this.track = chassis.wheelbase / 100;  // cm > N
        this.cameraHeight = 1;
        this.cameraBehind = 0;
        this.yawRate = 0;
        this.rollRate = 0;
        this.tyreGrip = 1; // 1G grip
        this.tyreSharpness = 1000; // N / radian / m/s  (?)
        const offsets = [this.frontWheelbase, -this.rearWheelbase];
        this.wheels = [];
        for (let i = 0; i < 4; i++) {
            this.wheels.push(new Wheel(
                this, 
                i, 
                offsets[Math.floor(i / 2)], 
                chassis.track / 200 * (i % 2 == 0 ? -1 : 1),
                suspension.totalTravel[i] * 0.01,  // cm -> m
                suspension.wheelRates[i], 
                suspension.damperRates[i]));
        }
        console.log(this);
        // console.log(this.wheels);
    }
    getCameraPose() {
        return {
            position: this.pose.position.clone().sub(this.pose.direction.clone().multiplyScalar(this.cameraBehind)).add(this.pose.up.clone().multiplyScalar(this.cameraHeight)),
            direction: this.pose.direction
        };
    } 
    rightVector() {
        return this.pose.direction.clone().cross(this.pose.up);
    }  
    controlCurve(steeringInput) {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5);
        return positiveInput * Math.sign(steeringInput);
    }
    update(frameInterval, meshes) {
        gamepad = navigator.getGamepads()[0]

        const time = frameInterval * 0.001;

        const force = new THREE.Vector3(0, 0, 0);
        force.add(this.weight);

        const steeringInput = this.controlCurve(gamepad.axes[2]);
        const steeringAngle = -(steeringInput) * this.maxSteeringLockRadians; 
        const brakeInput = gamepad.buttons[6].value;
        const brakeTorque = brakeInput * this.engine.maxBrakeTorque;

        const wheelForcesFront = this.wheels.slice(0, 2).map(wheel => wheel.getForce(meshes, steeringAngle, -brakeTorque, time));
        
        const throttleInput = gamepad.buttons[7].value;
        const accelTorque = throttleInput * this.engine.maxTorque;

        const wheelForcesRear = this.wheels.slice(2, 4).map(wheel => wheel.getForce(meshes, 0, accelTorque - brakeTorque, time));

        const frontForce = wheelForcesFront.reduce((a, b) => a.clone().add(b));
        const rearForce = wheelForcesRear.reduce((a, b) => a.clone().add(b));

        force.add(frontForce);
        force.add(rearForce);

        // Yaw - neglecting longitudinal forces
        const right = this.rightVector();
        const yawTorque = (rearForce.dot(right) * this.rearWheelbase) - frontForce.dot(right) * this.frontWheelbase;
        this.yawRate += (time * 0.2 * yawTorque / this.mass.yawInertia); // 0.2 to slow down rotation wrt lateral grip
        const yawDelta = this.yawRate * time;
        this.pose.direction.applyAxisAngle(this.pose.up, yawDelta);

        // Roll
        const leftForce = wheelForcesFront[0].clone().add(wheelForcesRear[0]);
        const rightForce = wheelForcesFront[1].clone().add(wheelForcesRear[1]);
        const rollTorque = leftForce.dot(this.pose.up) * (this.track / 2) -
                            rightForce.dot(this.pose.up) * (this.track / 2);
        this.rollRate += (time * rollTorque / this.mass.rollInertia)
        const rollDelta = this.rollRate * time;
        this.pose.up.applyAxisAngle(this.pose.direction, rollDelta);

        
        
        const acceleration = force.multiplyScalar(this.lightness);
        const dv = acceleration.multiplyScalar(time);
        this.velocity = this.velocity.clone().add(dv);
        this.pose.position.add(this.velocity.clone().multiplyScalar(time));
    }
    
}
