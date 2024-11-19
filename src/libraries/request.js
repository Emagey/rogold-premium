/*
    RoGold
    Coding and design by Alrovi Aps.
    Contact: contact@alrovi.com
    Copyright (C) Alrovi Aps
    All rights reserved.
*/
const savedMap = new Map();
const savedObject = {};

const sendResponse = (event, args) => {
    window.postMessage({
        type: event,
        details: args
    });
};

const requests = [];
let lastBool = false;
const scheduleRequest = (event, callback) => {
    requests.push({
        action: event,
        callback
    });
    if (!lastBool) {
        lastBool = true;
        window.addEventListener('message', ({ data }) => {
            if (data.type === 'request') {
                const { action, args } = data.details;
                const t = requests.filter(o => o?.action === action);
                t.forEach(o => o?.callback(args));
            }
        });
    }
};

const handleMap = async (event) => {
    let n = savedMap.get(event.action)(event.args);
    if (n instanceof Promise) {
        n = await n;
    }
    sendResponse('SendGlobalResponse', {
        eventName: event.action,
        args: n
    });
};

const addFunction = (name, func) => {
    savedMap.set(name, func);
    const queued = savedObject[name];
    if (queued && queued.length > 0) {
        queued.forEach(o => handleMap(o));
    }
    delete savedObject[name];
};


scheduleRequest('ChromeRequest', (e) => {
    if (savedMap.has(e.action)) {
        handleMap(e);
    } else {
        (savedObject[e.action] ||= []).push(e);
    }
});

function onSet(object, property, after) {
    return new Promise(resolve => {
        if (!after && object[property]) {
            return resolve(object[property]);
        }
        Object.defineProperty(object, property, {
            enumerable: false,
            configurable: true,
            set(value) {
                delete object[property];

                object[property] = value;
                resolve(value);
            }
        });
    });
}

async function getGlobals(object, array) {
    let globals = array.map(name => onSet(object, name).then(info => [name, info]));
    return Object.fromEntries(await Promise.all(globals));
}
const accessoryAssetTypeIds = [
    // Hat
    8,
    // Hair Accessory
    41,
    // Face Accessory
    42,
    // Neck Accessory
    43,
    // Shoulder Accessory
    44,
    // Front Accessory
    45,
    // Back Accessory
    46,
    // Waist Accessory
    47
];

const method = async (e) => {
    addFunction('Avatar.OverrideAssetTypeRestrictions', () => {
        onSet(e.Roblox, 'AvatarAccoutrementService').then((service) => {
            const originalAddAssetToAvatar = service.addAssetToAvatar;
            service.addAssetToAvatar = (asset, assets, clear) => {
                const original = originalAddAssetToAvatar(asset, assets, clear);

                let accesssoriesLeft = 10;
                const result = [asset, ...assets].filter((item) => {
                    if (item.assetType?.id && accessoryAssetTypeIds.includes(item.assetType.id)) {
                        if (accesssoriesLeft <= 0) {
                            return false;
                        }

                        accesssoriesLeft--;
                        return true;
                    }

                    return original.includes(item);
                });

                return result;
            };
        });
    });
};
(async () => {
    getGlobals(window, ['Roblox', 'angular'])
        .then(dependencies => method(dependencies))
        .catch(err => console.error(err));
})();