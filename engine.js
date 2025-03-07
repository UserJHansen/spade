// let jsr = 0x5EED;
// Math.random = () => {
//   jsr^=(jsr<<17);
//   jsr^=(jsr>>13);
//   jsr^=(jsr<<5);
//   return (jsr>>>0)/4294967295;
// };
let setTimeout, setInterval, clearInterval, clearTimeout;
const {
  /* sprite interactions */ setSolids, setPushables,
  /*              see also: sprite.x +=, sprite.y += */

  /* art */ setLegend, setBackground,
  /* text */ addText, clearText,

  /*   spawn sprites */ setMap, addSprite,
  /* despawn sprites */ clearTile, /* sprite.remove() */

  /* tile queries */ getGrid, getTile, getFirst, getAll, tilesWith,
  /* see also: sprite.type */

  /* map dimensions */ width, height,

  /* constructors */ bitmap, tune, map, color,

  /* input handling */ onInput, afterInput,

  /* how much sprite has moved since last onInput: sprite.dx, sprite.dy */

  playTune,
} = (() => {
const exports = {};
/* re-exports from C; bottom of module_native.c has notes about why these are in C */
exports.setMap = map => native.setMap(map.trim());
exports.addSprite = native.addSprite;
exports.getGrid = native.getGrid;
exports.getTile = native.getTile;
exports.tilesWith = native.tilesWith;
exports.clearTile = native.clearTile;
exports.getFirst = native.getFirst;
exports.getAll = native.getAll;
exports.width = native.width;
exports.height = native.height;
exports.setBackground = native.setBackground;
exports.playTune = (str, times) => {
  native.piano_queue_song(str, times);
  return {
    end: () => native.piano_unqueue_song(str),
    isPlaying: () => native.piano_is_song_queued(str)
  }
}

/* opts: x, y, color (all optional) */
exports.addText = (str, opts={}) => {
  console.log("engine.js:addText");
  const CHARS_MAX_X = 21;
  const padLeft = Math.floor((CHARS_MAX_X - str.length)/2);

  native.text_add(
    str,
    opts.color ?? [10, 10, 40],
    opts.x ?? padLeft,
    opts.y ?? 0
  );
}

exports.clearText = () => native.text_clear();


exports.setLegend = (...bitmaps) => {
  console.log("engine.js:setLegend");
  native.legend_clear();
  for (const [charStr, bitmap] of bitmaps) {
    native.legend_doodle_set(charStr, bitmap.trim());
  }
  native.legend_prepare();
};

exports.setSolids = solids => {
  console.log("engine.js:setSolids");
  native.solids_clear();
  solids.forEach(native.solids_push);
};

exports.setPushables = pushTable => {
  console.log("engine.js:setPushables");
  native.push_table_clear();
  for (const [pusher, pushesList] of Object.entries(pushTable))
    for (const pushes of pushesList)
      native.push_table_set(pusher, pushes);
};

let afterInputs = [];
exports.afterInput = fn => (console.log('engine.js:afterInputs'), afterInputs.push(fn));
// exports.afterInput = fn => afterInputs.push(fn);

const button = {
  pinToHandlers: {
     "5": [],
     "7": [],
     "6": [],
     "8": [],
    "12": [],
    "14": [],
    "13": [],
    "15": [],
  },
  keyToPin: {
    "w":  "5",
    "s":  "7",
    "a":  "6",
    "d":  "8",
    "i": "12",
    "k": "14",
    "j": "13",
    "l": "15",
  }
};

native.press_cb(pin => {
  if (button.pinToHandlers[pin])
    button.pinToHandlers[pin].forEach(f => f());

  afterInputs.forEach(f => f());

  native.map_clear_deltas();
});

{
  const timers = [];
  let id = 0;
  setTimeout  = (fn, ms=10) => (timers.push({ fn, ms, id }), id++);
  setInterval = (fn, ms=10) => (timers.push({ fn, ms, id, restartAt: ms }), id++);
  clearTimeout = clearInterval = id => {
    const index = timers.findIndex(t => t.id == id);
    if (index !== -1) timers.splice(index, 1);
  };
  native.frame_cb(dt => {
    const errors = [];

    for (const tim of [...timers]) {
      if (!timers.includes(tim)) continue; /* just in case :) */

      if (tim.ms <= 0) {
        /* trigger their callback */
        try {
          tim.fn();
        } catch (error) {
          if (error) errors.push(error);
        }

        /* restart intervals, clear timeouts */
        if (tim.restartAt !== undefined) {
          tim.ms = tim.restartAt;
        } else {
          const index = timers.indexOf(tim)
          if (index !== -1) timers.splice(index, 1);
        }
      }
      tim.ms -= dt;
    }

    /* we'll never need to throw more than one error -ced */
    if (errors.length > 0) throw errors[0];
  });
}

exports.onInput = (key, fn) => {
  console.log("engine.js:onInput");
  const pin = button.keyToPin[key];

  if (pin === undefined)
    throw new Error(`the sprig doesn't have a "${key}" button!`);

  button.pinToHandlers[pin].push(fn);
};

function _makeTag(cb) {
  return (strings, ...interps) => {
    if (typeof strings === "string") {
      throw new Error("Tagged template literal must be used like name`text`, instead of name(`text`)");
    }
    const string = strings.reduce((p, c, i) => p + c + (interps[i] ?? ''), '');
    return cb(string);
  }
}
exports.bitmap = _makeTag(text => text);
exports.tune = _makeTag(text => text);
exports.map = _makeTag(text => text);
exports.color = _makeTag(text => text);

// .at polyfill
function at(n) {
	// ToInteger() abstract op
	n = Math.trunc(n) || 0;
	// Allow negative indexing from the end
	if (n < 0) n += this.length;
	// OOB access is guaranteed to return undefined
	if (n < 0 || n >= this.length) return undefined;
	// Otherwise, this is just normal property access
	return this[n];
}

const TypedArray = Reflect.getPrototypeOf(Int8Array);
for (const C of [Array, String, TypedArray]) {
    Object.defineProperty(C.prototype, "at",
                          { value: at,
                            writable: true,
                            enumerable: false,
                            configurable: true });
}

return exports;
})();
