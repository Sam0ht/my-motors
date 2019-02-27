let gamepad

const reportGamepad = () => {
    reportString = ""
    gamepad.axes.forEach(axis => {
        reportString += axis + " ";
    });

    $("#gamepadValues").text(reportString);
}

const pickupGamepad = () => {
    gamepad = navigator.getGamepads()[0]
    $("#gamepadPrompt").text("Got gamepad with " + gamepad.axes.length + " axes");
    window.setInterval(reportGamepad, 250);
}

const initGamepad = () => {
    const prompt = "To begin using your gamepad, connect it and press any button!";
    $("#gamepadPrompt").text(prompt);

    const checkGP = window.setInterval(() => {
        if(navigator.getGamepads()[0]) {
            pickupGamepad();
            window.clearInterval(checkGP);
        }
    }, 500); 
}

initGamepad();