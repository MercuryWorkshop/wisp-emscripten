/**
 * @license
 * Copyright 2025 The Emscripten Authors SPDX-License-Identifier: MIT
 */


var LibraryWisp = {

  $Wisp__deps: [
  ],

  $Wisp__postset: "Wisp.init()",
  $Wisp: {
    wisp_connection: null,
    connection_promise: null,
    open_streams: {},
    init: () => {
#include "../node_modules/@mercuryworkshop/wisp-js/dist/wisp-client.js"

      Wisp.wisp_connection = new wisp_client.client.ClientConnection('{{{ WEBSOCKET_URL }}}');
      Wisp.connection_promise = new Promise((res, rej) => {
        Wisp.wisp_connection.onopen(() => res(true))
        Wisp.wisp_connection.onclose(() => res(false))
      });

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

      return stream.stream_id;
    },
  

};

addToLibrary(LibraryWisp);
