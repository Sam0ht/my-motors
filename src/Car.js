class Car {
    constructor(mass, chassis, suspension, engine, initialPose) {
        this.pose = initialPose;
        this.velocity = scale(this.pose.direction, 0.1); //new THREE.Vector3(0, 0, 0);
        this.mass = mass;
        this.weight = scale(gravity, this.mass.mass);
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
        this.pitchRate = 0;
        this.tyreGrip = 1; // 1G grip
        this.tyreSharpness = 1000; // N / radian / m/s  (?)
        const offsets = [this.frontWheelbase, -this.rearWheelbase];
        this.wheels = [];
        this.cgHeightInChassis = this.mass.cgPosition[1] * 0.01;
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
    }
    getCameraPose() {
        return {
            position: sum(this.pose.position, scale(this.pose.direction, -this.cameraBehind), scale(this.pose.up, this.cameraHeight)),
            direction: this.pose.direction,
            up: this.pose.up
        };
    } 
    rightVector() {
        return cross(this.pose.direction, this.pose.up);
    }  
    controlCurve(steeringInput) {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5);
        return positiveInput * Math.sign(steeringInput);
    }
    update(frameInterval, meshes, { steeringInput, throttleInput, brakeInput }) {

        const time = frameInterval * 0.001;

        const force = new THREE.Vector3(0, 0, 0);
        force.add(this.weight);

        const steeringAngle = -(steeringInput) * this.maxSteeringLockRadians; 
        const brakeTorque = brakeInput * this.engine.maxBrakeTorque;

        const frontWheels = this.wheels.slice(0, 2).map(wheel => wheel.getForce(meshes, steeringAngle, -brakeTorque, time));
        const wheelForcesFront = frontWheels.map(wheel => wheel.force);
        
        const accelTorque = throttleInput * this.engine.maxTorque;

        const rearWheels = this.wheels.slice(2, 4).map(wheel => wheel.getForce(meshes, 0, accelTorque - brakeTorque, time));
        const wheelForcesRear = rearWheels.map(wheel => wheel.force);

        const frontForce = wheelForcesFront.reduce((a, b) => a.clone().add(b));
        const rearForce = wheelForcesRear.reduce((a, b) => a.clone().add(b));
        const totalForce = sum(frontForce, rearForce);

        force.add(totalForce);

        const wheelStates = frontWheels.concat(rearWheels);
        const groundUps = wheelStates.map(wheel => wheel.up !== undefined ? wheel.up : up);
        const groundUp = groundUps.reduce((a, b) => a.clone().add(b)).normalize();


        // Yaw - neglecting longitudinal forces
        const right = cross(this.pose.direction, groundUp);
        const yawTorque = (dot(rearForce, right) * this.rearWheelbase) - dot(frontForce, right) * this.frontWheelbase;
        this.yawRate += (time * 0.2 * yawTorque / this.mass.yawInertia); // 0.2 to slow down rotation wrt lateral grip
        const yawDelta = this.yawRate * time;
        this.pose.direction.applyAxisAngle(groundUp, yawDelta);

        // Roll
        const leftForce = sum(wheelForcesFront[0], wheelForcesRear[0]);
        const rightForce = sum(wheelForcesFront[1], wheelForcesRear[1]);
        let rollTorque = dot(leftForce, this.pose.up) * (this.track / 2) -
                            dot(rightForce, this.pose.up) * (this.track / 2);


        const heights = wheelStates.map(wheel => wheel.height !== undefined ? wheel.height : this.pose.position.y);
        const height = heights.reduce((a, b) => a + b) / heights.length;
        const totalLateralForce = -dot(totalForce, right);
        const cgHeight = this.cgHeightInChassis + height;
        rollTorque += (totalLateralForce * cgHeight);

        this.rollRate += (time * rollTorque * 0.2 / this.mass.rollInertia)
        const rollDelta = this.rollRate * time;
        this.pose.up.applyAxisAngle(this.pose.direction, rollDelta);

        // Pitch
        let pitchTorque = dot(frontForce, this.pose.up) * (this.frontWheelbase) - dot(rearForce, this.pose.up) * this.rearWheelbase;
        const totalLongitudinalForce = dot(totalForce, this.pose.direction);
        pitchTorque += (totalLongitudinalForce * cgHeight);
        
        this.pitchRate += (time * 0.2 * pitchTorque / this.mass.pitchInertia);
        const pitchDelta = this.pitchRate * time;
        this.pose.direction.applyAxisAngle(right, pitchDelta);
        this.pose.up.applyAxisAngle(right, pitchDelta);
        
        
        const acceleration = scale(force, this.lightness);
        const dv = scale(acceleration, time);
        this.velocity = sum(this.velocity, dv);
        this.pose.position.add(scale(this.velocity, time));

        const displacements = this.wheels.map(wheel => wheel.lastDisplacement ? wheel.lastDisplacement.toFixed(3) : 0);
        return ["CGHeight", cgHeight.toFixed(2), "RollTorque", rollTorque.toFixed(3), "LatForce", totalLateralForce.toFixed(3), "displacements", displacements];
    }
    
}
