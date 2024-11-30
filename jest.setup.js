import '@testing-library/jest-dom'
import { TextEncoder, TextDecoder } from 'util'
import fetch from 'node-fetch'

global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.fetch = fetch 

// Mock global Request and Response
global.Request = class Request {
  constructor(input, init = {}) {
    this.url = input
    this.method = init.method || 'GET'
    this.headers = new Headers(init.headers)
    this._body = init.body

    // Add json method
    this.json = async () => {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
    }
  }
}

global.Headers = class Headers {
  constructor(init = {}) {
    this._headers = new Map()
    if (typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value)
      })
    }
  }

  get(name) {
    return this._headers.get(name.toLowerCase()) || null
  }

  set(name, value) {
    this._headers.set(name.toLowerCase(), value)
  }

  has(name) {
    return this._headers.has(name.toLowerCase())
  }
}

// Improved Response mock
global.Response = class Response {
  constructor(body, init = {}) {
    this._body = body
    this.status = init.status || 200
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new Headers(init.headers)
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
  }

  async text() {
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body)
  }
}

// Mock NextResponse
global.NextResponse = class NextResponse extends Response {
  static json(body, init = {}) {
    return new NextResponse(
      JSON.stringify(body),
      {
        ...init,
        headers: {
          ...init.headers,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

// Mock fetch API environment
global.Response = Response
global.Headers = Headers
global.Request = Request

// Add FormData if needed
global.FormData = class FormData {
  constructor() {
    this._data = new Map()
  }
  
  append(key, value) {
    this._data.set(key, value)
  }
  
  get(key) {
    return this._data.get(key)
  }
}

// Add URL if needed
global.URL = URL
global.URLSearchParams = URLSearchParams