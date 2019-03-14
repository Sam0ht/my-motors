class Gamepad {

    getInputs = () => {
        gamepad = navigator.getGamepads()[0]
        const steeringInput = this.controlCurve(gamepad.axes[2]);
        const throttleInput = gamepad.buttons[7].value;
        const brakeInput = gamepad.buttons[6].value;
        return { steeringInput, throttleInput, brakeInput }
    }

    controlCurve = (steeringInput) => {
        const absIn = Math.abs(steeringInput);
        const positiveInput = absIn * 0.5 + Math.max(0, absIn - 0.5);
        return positiveInput * Math.sign(steeringInput);
    }
    
}