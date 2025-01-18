/**
 * @license
 * Copyright 2025 The Emscripten Authors SPDX-License-Identifier: MIT
 */


var LibraryWisp = {
  $Wisp__postset: "Wisp.init()",
  $Wisp: {
    wisp_connection: null,
    open_streams: {},
    init: () => {
#include "../node_modules/@mercuryworkshop/wisp-js/dist/wisp-client.js"

      Wisp.wisp_connection = new wisp_client.client.ClientConnection('{{{ WEBSOCKET_URL }}}');

      console.log("Init Wisp");
    },
  },

  emscripten_wisp_get_status__deps: ["$Wisp"],
  emscripten_wisp_get_status: () => {
      if(Wisp.wisp_connection === null || Wisp.wisp_connection === undefined) {
        return 0;
      }
      return Wisp.wisp_connection.connected;
    },

  emscripten_wisp_create_stream__deps: ["$Wisp", "$UTF8ToString"],
  emscripten_wisp_create_stream__sig: "ipip",
  emscripten_wisp_create_stream: (hostname, port, type) => {
      let stream = Wisp.wisp_connection.create_stream(UTF8ToString(hostname), port, UTF8ToString(type));
      Wisp.open_streams[stream.stream_id] = {read_queue: new Uint8Array([]), read_listeners: [], closed: false, stream: stream};

      stream.onmessage = (event) => {
        Wisp.open_streams[stream.stream_id].read_queue = [...Wisp.open_streams[stream.stream_id].read_queue, ...event];
        Wisp.open_streams[stream.stream_id].read_listeners.map((listener) => listener());
        Wisp.open_streams[stream.stream_id].read_listeners = [];
      };

      stream.onclose = (event) => {
        Wisp.open_streams[stream.stream_id].closed = true;
      };

      return stream.stream_id;
    },

  emscripten_wisp_send__deps: ["$Wisp", "$UTF8ToString"],
  emscripten_wisp_send__sig: "vipj",
  emscripten_wisp_send: (stream_id, buffer, size) => {
    let buffer_data = HEAPU8.subarray(buffer, buffer + size)
    Wisp.open_streams[stream_id].stream.send(new Uint8Array(buffer_data))
  },

  emscripten_wisp_read__deps: ["$Wisp", "$UTF8ToString"],
  emscripten_wisp_read__sig: "jipj",
  emscripten_wisp_read: (stream_id, buffer, size) => {
    function actual_read() {
      let actual_size = Math.min(Wisp.open_streams[stream_id].read_queue.length, size);
      const return_buffer = Wisp.open_streams[stream_id].read_queue.slice(0, actual_size);

      Wisp.open_streams[stream_id].read_queue = Wisp.open_streams[stream_id].read_queue.slice(actual_size);

      HEAPU8.set(return_buffer, buffer)
      return actual_size;
    }

    if (Wisp.open_streams[stream_id].closed && Wisp.open_streams[stream_id].read_queue.length == 0) { // stream closed (no data)
      return 0;
    } 
    return actual_read();

  },

  emscripten_wisp_stream_ready__deps: ["$Wisp"],
  emscripten_wisp_stream_ready: (stream_id) => {
    if(!Wisp.open_streams[stream_id].closed && Wisp.open_streams[stream_id].read_queue.length == 0) {
      return false;
    }
    return true;
  },

};

addToLibrary(LibraryWisp);
