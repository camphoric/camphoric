"""
inspired by
https://realpython.com/testing-third-party-apis-with-mock-servers/
"""

from collections import deque
from http.server import BaseHTTPRequestHandler, HTTPServer
from threading import Thread
import json
import socket


class MockServer:
    """
    A server for testing code that communicates with external HTTP APIs

    add_mock_response() must be called for each expected request. Each request
    received will return the next mock response in the list.

    Attributes:
        host: the hostname/IP on which the server is listening
        port: the port on which the server is listening, available after calling start()
        requests: list of requests received, each of which is a dict with the following keys:
            'method': 'GET', 'POST', etc.
            'path_query': request path and query
            'headers': dict of request headers
            'text': request body as a string
            'json': request body decoded from JSON, if request body is JSON
    """

    def __init__(self):
        self.host = 'localhost'
        self.port = None
        self.requests = []
        self._server = None
        self._mock_responses = deque([])

    def start(self):
        self.port = self._get_free_port()

        # a trick to pass self to the RequestHandler
        def handler(*args, **kwargs):
            return _MockServerRequestHandler(self, *args, **kwargs)

        self._server = HTTPServer((self.host, self.port), handler)
        self._server_thread = Thread(target=self._server.serve_forever)
        self._server_thread.daemon = True
        self._server_thread.start()

    def stop(self):
        self._server.shutdown()
        self._server_thread.join()
        self._server = None
        self.port = None

    def add_mock_response(self, status_code, headers, json):
        self._mock_responses.append({
            'status_code': status_code,
            'headers': headers,
            'json': json,
        })

    def reset(self):
        self._mock_responses = deque([])
        self.requests = []

    def _get_free_port(self):
        s = socket.socket(socket.AF_INET, type=socket.SOCK_STREAM)
        s.bind((self.host, 0))
        address, port = s.getsockname()
        s.close()
        return port

    def _handle_request(self, handler):
        text = ''
        json_data = None
        body = handler.rfile.read(int(handler.headers.get('content-length', 0)))
        if body:
            text = body.decode('utf-8')
            json_data = json.loads(text)

        self.requests.append({
            'method': handler.command,
            'path_query': handler.path,
            'headers': dict(handler.headers),
            'text': text,
            'json': json_data,
        })

        if len(self._mock_responses) == 0:
            handler.send_error(500, 'no mock responses left')
            return

        response = self._mock_responses.popleft()

        handler.send_response(response['status_code'])
        handler.send_header('Content-Type', 'application/json; charset=utf-8')
        for key, value in response['headers'].items():
            handler.send_header(key, value)
        handler.end_headers()
        handler.wfile.write(json.dumps(response['json']).encode('utf-8'))


class _MockServerRequestHandler(BaseHTTPRequestHandler):
    def __init__(self, mock_server, *args, **kwargs):
        self.mock_server = mock_server
        super().__init__(*args, **kwargs)

    def do_GET(self):
        self.mock_server._handle_request(self)

    def do_POST(self):
        self.mock_server._handle_request(self)

    def log_request(self, *args):
        pass
