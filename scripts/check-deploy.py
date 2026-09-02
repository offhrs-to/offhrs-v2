import re
import sys
import urllib.request

url = sys.argv[1] if len(sys.argv) > 1 else "https://offhrs-v2-30qf5ii2t-offhrs-projects.vercel.app/partners/login"
html = urllib.request.urlopen(url).read().decode("utf-8", errors="ignore")
print("len", len(html))
print("tryCreateClient", "tryCreateClient" in html)
print("Preview misconfiguration", "Preview misconfiguration" in html)
print("supabaseUrl is required", "supabaseUrl is required" in html)
print("Application error", "Application error" in html)
chunks = re.findall(r"/_next/static/chunks/[^\"']+\.js", html)
for c in chunks[:12]:
    print("chunk", c)
