// let gamepad

// const reportGamepad = () => {
//     reportString = ""
//     gamepad.axes.forEach(axis => {
//         reportString += axis + " ";
//     });

//     $("#gamepadValues").text(reportString);
// }

const pickupGamepad = () => {
    window.gamepad = navigator.getGamepads()[0]
    // $("#gamepadPrompt").text("Got gamepad with " + window.gamepad.axes.length + " axes");    
    // $("#gamepadPrompt").remove();    
    startGraphics();
}

const initGamepad = () => {
    // const prompt = "To begin using your gamepad, connect it and press any button!";
    // $("#gamepadPrompt").text(prompt);

    const checkGP = window.setInterval(() => {
        if(navigator.getGamepads()[0]) {
            console.log("Gamepad available")
            pickupGamepad();
            window.clearInterval(checkGP);
        }
    }, 500); 
}

initGamepad();