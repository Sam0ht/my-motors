class Wheel {
    constructor(car, index, longOffset, latOffset, travel, springRate, damperRate) {
        this.parent = car;
        this.index = index;
        this.longOffset = longOffset;
        this.latOffset = latOffset;
        this.travel = travel;
        this.springRate = springRate * 10; // kg/m > N/m
        this.damperRate = damperRate;
    }
    
    getRay = () => {
        const carPose = this.parent.pose;
        const longOffset = scale(carPose.direction, this.longOffset);
        const latOffset = scale(this.parent.rightVector(), this.latOffset);
        const origin = sum(carPose.position, longOffset, latOffset, carPose.up);
        const direction = scale(carPose.up, -1);
        return new THREE.Raycaster(origin, direction);
    }
    
    heightAboveGround = (meshes) => {
        const ray = this.getRay();
        const intersections = meshes.map(mesh => ray.intersectObject(mesh)).flat(2);
        return intersections.slice(0,1);  // first intersection or nothing
    }
      
    getForce = (meshes, steeringAngle, netAppliedTorque, time) => {

        const force = new THREE.Vector3(0, 0, 0);
        const maybeIntersection = this.heightAboveGround(meshes);
        
        //TODO duplication
        if (maybeIntersection.length === 0 || (maybeIntersection[0].distance - 1) > this.travel) {
            return { force };  // wheel is not touching the ground so applies no forces
        }
        const {distance: d, face} =  maybeIntersection[0];
        const height = d - 1;

        const up = face.normal;  // normal of ground at contact point
        const direction = rotateByAround(this.parent.pose.direction, steeringAngle, up);  // car heading plus any steering lock
        const right = cross(direction, up); // should point along wheel 'axle'

        const displacement = this.travel - height;        

        // spring + damper
        let verticalForce = displacement * this.springRate;
        if (this.lastDisplacement !== undefined && this.prevDisplacement !== undefined) {
            
            const oldDisplacement = (this.lastDisplacement + this.prevDisplacement) / 2
            const verticalWheelRate = (displacement - oldDisplacement) / time;
            const damperForce = this.damperRate * verticalWheelRate;
            verticalForce += damperForce;
        } 
        force.add(scale(up, verticalForce));
        this.prevDisplacement = this.lastDisplacement;
        this.lastDisplacement = displacement;
        

        // brake and acceleration
        const availableTraction = verticalForce * this.parent.tyreGrip;
        const longitudinalForce = Math.min(netAppliedTorque, availableTraction);
        force.add(scale(direction, longitudinalForce));

        // lateral

        const spinVelocity = -this.longOffset * this.parent.yawRate;
        const wheelVelocity = sum(this.parent.velocity, scale(this.parent.rightVector(), spinVelocity));
        const slipAngle = angleFrom(wheelVelocity, direction, up);
       
        const slipForce = slipAngle * wheelVelocity.length() * this.parent.tyreSharpness;
        const lateralForce = Math.min(slipForce, availableTraction);
        force.add(scale(right, -lateralForce));
        const wheelIsSlipping = slipForce > availableTraction;

        return { force, up, wheelIsSlipping, height }; 
    }
}
