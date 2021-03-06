import { Ease } from './Controller.js'
import {
  delimiter,
  numberAndUnit,
  pathLetters
} from '../modules/core/regex.js'
import { extend } from '../utils/adopter.js'
import Color from '../types/Color.js'
import PathArray from '../types/PathArray.js'
import SVGArray from '../types/SVGArray.js'
import SVGNumber from '../types/SVGNumber.js'

const getClassForType = (value) => {
  const type = typeof value

  if (type === 'number') {
    return SVGNumber
  } else if (type === 'string') {
    if (Color.isColor(value)) {
      return Color
    } else if (delimiter.test(value)) {
      return pathLetters.test(value)
        ? PathArray
        : SVGArray
    } else if (numberAndUnit.test(value)) {
      return SVGNumber
    } else {
      return NonMorphable
    }
  } else if (morphableTypes.indexOf(value.constructor) > -1) {
    return value.constructor
  } else if (Array.isArray(value)) {
    return SVGArray
  } else if (type === 'object') {
    return ObjectBag
  } else {
    return NonMorphable
  }
}

export default class Morphable {
  constructor (stepper) {
    this._stepper = stepper || new Ease('-')

    this._from = null
    this._to = null
    this._type = null
    this._context = null
    this._morphObj = null
  }

  from (val) {
    if (val == null) {
      return this._from
    }

    this._from = this._set(val)
    return this
  }

  to (val) {
    if (val == null) {
      return this._to
    }

    this._to = this._set(val)
    return this
  }

  type (type) {
    // getter
    if (type == null) {
      return this._type
    }

    // setter
    this._type = type
    return this
  }

  _set (value) {
    if (!this._type) {
      this.type(getClassForType(value))
    }

    var result = (new this._type(value))
    if (this._type === Color) {
      result = this._to ? result[this._to[4]]()
        : this._from ? result[this._from[4]]()
        : result
    }

    if (this._type === ObjectBag) {
      result = this._to ? result.align(this._to)
        : this._from ? result.align(this._from)
        : result
    }

    result = result.toArray()

    this._morphObj = this._morphObj || new this._type()
    this._context = this._context
      || Array.apply(null, Array(result.length))
        .map(Object)
        .map(function (o) {
          o.done = true
          return o
        })
    return result
  }

  stepper (stepper) {
    if (stepper == null) return this._stepper
    this._stepper = stepper
    return this
  }

  done () {
    var complete = this._context
      .map(this._stepper.done)
      .reduce(function (last, curr) {
        return last && curr
      }, true)
    return complete
  }

  at (pos) {
    var _this = this

    return this._morphObj.fromArray(
      this._from.map(function (i, index) {
        return _this._stepper.step(i, _this._to[index], pos, _this._context[index], _this._context)
      })
    )
  }
}

export class NonMorphable {
  constructor (...args) {
    this.init(...args)
  }

  init (val) {
    val = Array.isArray(val) ? val[0] : val
    this.value = val
    return this
  }

  valueOf () {
    return this.value
  }

  toArray () {
    return [ this.value ]
  }
}

export class TransformBag {
  constructor (...args) {
    this.init(...args)
  }

  init (obj) {
    if (Array.isArray(obj)) {
      obj = {
        scaleX: obj[0],
        scaleY: obj[1],
        shear: obj[2],
        rotate: obj[3],
        translateX: obj[4],
        translateY: obj[5],
        originX: obj[6],
        originY: obj[7]
      }
    }

    Object.assign(this, TransformBag.defaults, obj)
    return this
  }

  toArray () {
    var v = this

    return [
      v.scaleX,
      v.scaleY,
      v.shear,
      v.rotate,
      v.translateX,
      v.translateY,
      v.originX,
      v.originY
    ]
  }
}

TransformBag.defaults = {
  scaleX: 1,
  scaleY: 1,
  shear: 0,
  rotate: 0,
  translateX: 0,
  translateY: 0,
  originX: 0,
  originY: 0
}

const sortByKey = (a, b) => {
  return (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0))
}

export class ObjectBag {
  constructor (...args) {
    this.init(...args)
  }

  init (objOrArr) {
    this.values = []

    if (Array.isArray(objOrArr)) {
      this.values = objOrArr.slice()
      return
    }

    objOrArr = objOrArr || {}
    var entries = []

    for (const i in objOrArr) {
      const Type = getClassForType(objOrArr[i])
      const val = new Type(objOrArr[i]).toArray()
      entries.push([ i, Type, val.length, ...val ])
    }

    entries.sort(sortByKey)

    this.values = entries.reduce((last, curr) => last.concat(curr), [])
    return this
  }

  valueOf () {
    var obj = {}
    var arr = this.values

    // for (var i = 0, len = arr.length; i < len; i += 2) {
    while (arr.length) {
      const key = arr.shift()
      const Type = arr.shift()
      const num = arr.shift()
      const values = arr.splice(0, num)
      obj[key] = new Type(values).valueOf()
    }

    return obj
  }

  toArray () {
    return this.values
  }

  align (other) {
    for (let i = 0, il = this.values.length; i < il; ++i) {
      if (this.values[i] === Color) {
        const space = other[i + 6]
        const color = new Color(this.values.splice(i + 2, 5))[space]().toArray()
        this.values.splice(i + 2, 0, ...color)
      }
    }
    return this
  }
}

const morphableTypes = [
  NonMorphable,
  TransformBag,
  ObjectBag
]

export function registerMorphableType (type = []) {
  morphableTypes.push(...[].concat(type))
}

export function makeMorphable () {
  extend(morphableTypes, {
    to (val) {
      return new Morphable()
        .type(this.constructor)
        .from(this.valueOf())
        .to(val)
    },
    fromArray (arr) {
      this.init(arr)
      return this
    }
  })
}
