// Alternative socket system implementation that gets compiled to
// libsockets_wisp_proxy.a and included when the `-sPROXY_POSIX_SOCKETS -sWISP`
// and link with `-lwisp.js`

#include "emscripten/em_types.h"
#include <assert.h>
#include <cstdint>
#include <cstring>
#include <errno.h>
#include <limits.h>
#include <netdb.h>
#include <netinet/in.h>
#include <optional>
#include <pthread.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string>
#include <sys/socket.h>
#include <unordered_map>
#if defined(__APPLE__) || defined(__linux__)
#include <arpa/inet.h>
#endif

#include <emscripten/console.h>
#include <emscripten/threading.h>
#include <emscripten/websocket.h>

extern "C" {
EMSCRIPTEN_RESULT emscripten_wisp_get_status();

EMSCRIPTEN_RESULT
emscripten_wisp_create_stream(char* hostname __attribute__((nonnull)),
                              int port,
                              char* type __attribute__((nonnull)));
}

struct SocketFile {
  int filesystem_id = 0;

  int domain = 0;
  int type = 0;
  int protocol = 0;

  bool connnected = false;
  std::optional<uint32_t> stream_id;
};
int next_filesystem_id = 0;
std::unordered_map<int, SocketFile> socket_filesystem;

void wisp_wait() { // TODO: remove asyncify?
  while (true) {
    if (emscripten_wisp_get_status() == 1)
      break;
    emscripten_sleep(100);
  }
}

int socket(int domain, int type, int protocol) {
  wisp_wait();

  if (domain != AF_INET && domain != AF_INET6) {
    errno = EAFNOSUPPORT;
    return -1;
  }
  if (type != SOCK_STREAM && type != SOCK_DGRAM) {
    errno = EPROTONOSUPPORT;
    return -1;
  }
  if (protocol != 0) { // TODO: implement nonblocking
    errno = EINVAL;
    return -1;
  }

  socket_filesystem[next_filesystem_id].filesystem_id = next_filesystem_id;
  next_filesystem_id++;

  socket_filesystem[next_filesystem_id].domain = domain;
  socket_filesystem[next_filesystem_id].type = type;
  socket_filesystem[next_filesystem_id].protocol = protocol;
  return 0;
}

struct WispSockAddr {
  uint16_t port;
  char hostname[];
};
int getaddrinfo(const char* node,
                const char* service,
                const struct addrinfo* hints,
                struct addrinfo** res) {
  // dns is handled by wisp

  *res = (struct addrinfo*)malloc(sizeof(addrinfo));
  (**res).ai_addrlen = sizeof(uint16_t) + strlen(node);
  (**res).ai_addr =
    (struct sockaddr*)calloc(1, sizeof(uint16_t) + strlen(node) + 1);
  if ((**res).ai_addr == NULL) {
    return EAI_MEMORY;
  }
  WispSockAddr* sock_addr = (WispSockAddr*)(**res).ai_addr;
  memcpy(sock_addr->hostname, node, strlen(node));

  errno = 0;
  sock_addr->port = (uint16_t)strtol(service, NULL, 10);
  if (errno != 0)
    return EAI_SERVICE;

  (**res).ai_next = NULL;

  return 0;
}

void freeaddrinfo(struct addrinfo* res) {
  free(res->ai_addr);
  free(res);
}

int connect(int sockfd, const struct sockaddr* addr, socklen_t addrlen) {
  if (socket_filesystem.find(sockfd) == socket_filesystem.end()) {
    errno = EBADF;
    return -1;
  }
  SocketFile* socket_file = &socket_filesystem[sockfd];

  WispSockAddr* wisp_addr = (WispSockAddr*)addr;
  socket_file->stream_id = emscripten_wisp_create_stream(
    (char*)wisp_addr->hostname,
    wisp_addr->port,
    (socket_file->protocol == SOCK_STREAM ? (char*)"tcp" : (char*)"udp"));

  return 0;
}
