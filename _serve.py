#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《掌灯》静态文件服务（替代 python -m http.server）

为什么要自己写：`python -m http.server` 只发 Last-Modified、不发 Cache-Control，
浏览器于是按「启发式新鲜度」把 index.html / app.js / plays.js / scenery.js 缓存住——
改了代码，用户按 F5 仍然跑旧代码，页面看着正常但内容全是旧的（"这个还没变"就是这么来的）。

这里对 html/js/css/json 一律发 no-store（每次都必须回来问服务器）；
对体积大的资源（.wasm / .task / 模型 / 图片）保留长缓存，靠 URL 里的 ?v=NN 失效。

用法：  python _serve.py 8124        （只绑 127.0.0.1，不对外）
"""
import http.server
import mimetypes
import os
import socketserver
import sys

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/octet-stream", ".task")

NO_STORE = {".html", ".htm", ".js", ".mjs", ".css", ".json", ".map"}
IMMUTABLE = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
             ".wasm", ".task", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".ogg"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        ext = os.path.splitext(path)[1].lower()
        if ext in NO_STORE:
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        elif ext in IMMUTABLE:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        super().end_headers()

    def log_message(self, fmt, *args):          # 只在出错时吭声，别把终端刷满
        if str(args[1] if len(args) > 1 else "") >= "400":
            sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):   # 多线程：不然后台拉几十 MB 会堵死其他人
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with Server(("127.0.0.1", port), Handler) as httpd:
        print("掌灯 · 手势皮影戏  →  http://127.0.0.1:%d/   （Ctrl+C 停止）" % port)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
