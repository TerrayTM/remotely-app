const io = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');
const { server } = require('../../../config');
const { desktopCapturer } = require('electron');

let socket = null;
let inputCommands = null;
let apiSetup = false;
let password = null;
let authenticated = false;
let loginCounts = 0;
let videoHandle = null;

const setup = () => {
    if (!inputCommands) {
        inputCommands = spawn(path.join(path.dirname(__dirname), 'api/input-commands.exe'));

        inputCommands.stdout.on('data', (data) => {
            if (apiSetup) {
                return;
            }

            if (data.toString().includes('Input Commands')) {
                apiSetup = true;
            } else {
                apiSetup = false;
            }
        });
    }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const connect = async (connectionError, disconnect, connected, userJoined, userLeft, passwordError) => {
    loginCounts = 0;
    authenticated = false;

    if (socket) {
        return false;
    }

    try {
        if (!apiSetup) {
            setup();

            await sleep(1500);

            if (!apiSetup) {
                inputCommands = null;

                return false;
            }
        }

        socket = io.connect(server, {
            reconnection: false
        });

        socket.on('connect_error', () => {
            socket = null;

            connectionError();
        });

        socket.on('disconnect', () => {
            socket = null;

            endSession();
            disconnect();
        });

        socket.on('connect', connected);

        socket.on('userJoined', (passcode, callback) => {
            if (passcode !== password) {
                callback(false);

                ++loginCounts;

                if (loginCounts > 5) {
                    endSession();
                    passwordError();
                }
            } else {
                loginCounts = 0;
                authenticated = true;

                const size = { 
                    width: screen.width,
                    height: screen.height
                };

                userJoined();
                callback(true, size.width / size.height, size);
                beginVideo();
            }
        });

        socket.on('userLeft', () => {
            stopVideo();
            userLeft();
        });

        socket.on('keyBoardEvent', (keys) => {
            if (inputCommands && authenticated) {
                inputCommands.stdin.write(`SendKeys ${keys}\n`);
            }
        });

        socket.on('mouseLeftDown', (position) => {
            if (inputCommands && authenticated) {
                inputCommands.stdin.write(`MouseLeftDown ${position}\n`);
            }
        });

        socket.on('mouseLeftUp', (position) => {
            if (inputCommands && authenticated) {
                inputCommands.stdin.write(`SetMousePosition ${position}\n`);

                setTimeout(() => {
                    inputCommands.stdin.write(`MouseLeftUp ${position}\n`);
                }, 50);
            }
        });

        socket.on('mouseRightDown', (position) => {
            if (inputCommands && authenticated) {
                inputCommands.stdin.write(`MouseRightDown ${position}\n`);
            }
        });

        socket.on('mouseRightUp', (position) => {
            if (inputCommands && authenticated) {
                inputCommands.stdin.write(`SetMousePosition ${position}\n`);

                setTimeout(() => {
                    inputCommands.stdin.write(`MouseRightUp ${position}\n`);
                }, 50);
            }
        });
    } catch (error) {
        return false;
    }

    return true;
};

const generateID = (length) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var charactersLength = characters.length;
    for (let i = 0; i < length; ++i) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

const createSession = async (connectionError, sessionCreated) => {
    if (socket) {
        let idValid = false;
        let id = null;

        while (!idValid) {
            const candidate = generateID(8);

            if (candidate === 'XXXXXXXX') {
                continue;
            }

            const params = {
                method: 'POST',
                headers: {
                    'Accept': 'application/text',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: candidate
                })
            };

            try {
                let response = await fetch(`${server}/session`, params);
                response = await response.text();

                if (response && response === 'VALID') {
                    idValid = false;
                } else if (response && response === 'INVALID') {
                    idValid = true;
                    id = candidate;
                }
            } catch (error) {
                socket.disconnect();

                socket = null;

                connectionError();
            }
        }

        socket.emit('createSession', id, (success) => {
            if (!success) {
                socket.disconnect();

                socket = null;

                connectionError();
            } else {
                password = generateID(6);

                sessionCreated(id, password);
            }
        });
    } else {
        connectionError();
    }
};

const endSession = () => {
    stopVideo();

    if (socket) {
        socket.disconnect();
    }

    socket = null;
};

const closeAPI = () => {
    endSession();

    if (apiSetup && inputCommands) {
        inputCommands.kill('SIGINT');
    }
};

const sendScreenShot = () => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: screen.width, height: screen.height } }, (error, sources) => {
        if (!error) {
            for (let i = 0; i < sources.length; ++i) {
                if (sources[i].name === 'Entire screen' || sources[i].name === 'Screen 1') {
                    if (socket && authenticated) {
                        socket.emit('screenShot', btoa(String.fromCharCode.apply(null, new Uint8Array(sources[i].thumbnail.toJPEG(40)))));
                    }
                    break;
                }
            }
        }
    });
};

const beginVideo = () => videoHandle = setInterval(() => {
    sendScreenShot();
}, 800);

const stopVideo = () => {
    if (videoHandle) {
        clearInterval(videoHandle);

        videoHandle = null;
    }
};

const uploadFile = (file) => {
    if (socket && authenticated) {
        socket.emit('file', file, file.name);
    }
};

module.exports = {
    connect,
    createSession,
    endSession,
    closeAPI,
    uploadFile
};