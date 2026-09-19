"""Local preview server for the vocabulary site. Sends no-store so edits show up on reload."""
import functools, http.server, os, socketserver, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()
    def log_message(self, *a):
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), functools.partial(Handler, directory=ROOT)) as httpd:
        print(f"serving {ROOT} on http://localhost:{port}", flush=True)
        httpd.serve_forever()
