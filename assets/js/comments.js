(function () {
  var box = document.getElementById("comments");
  if (!box) return;
  var api = box.getAttribute("data-api"), post = box.getAttribute("data-post");
  var likeBtn = document.getElementById("likeBtn"), likeCount = document.getElementById("likeCount");
  var list = document.getElementById("clist"), avg = document.getElementById("avg");
  var form = document.getElementById("cf"), msg = document.getElementById("cmsg");
  var key = "liked:" + post;

  function call(o) {
    o.post = post;
    return fetch(api, { method: "POST", body: new URLSearchParams(o) })
      .then(function (r) { return r.json(); });
  }
  function getLiked() { try { return localStorage.getItem(key) === "1"; } catch (e) { return false; } }
  function setLiked(v) {
    try { if (v) localStorage.setItem(key, "1"); else localStorage.removeItem(key); } catch (e) {}
  }
  function paintLike(n, on) {
    likeCount.textContent = n;
    likeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    likeBtn.classList.toggle("on", on);
  }
  function stars(n) { return "\u2605\u2605\u2605\u2605\u2605".slice(0, n) + "\u2606\u2606\u2606\u2606\u2606".slice(0, 5 - n); }

  function render(r) {
    paintLike(r.likes || 0, getLiked());
    avg.textContent = r.rated ? "Average rating " + r.avg + " / 5 (" + r.rated + ")" : "";
    list.textContent = "";
    if (!r.comments.length) {
      var e = document.createElement("p");
      e.className = "empty";
      e.textContent = "No comments yet. Be the first.";
      list.appendChild(e);
      return;
    }
    r.comments.forEach(function (c) {
      var d = document.createElement("div"); d.className = "comment";
      var h = document.createElement("div"); h.className = "chead";
      var b = document.createElement("strong"); b.textContent = c.name; h.appendChild(b);
      if (c.stars) {
        var s = document.createElement("span"); s.className = "stars";
        s.textContent = stars(c.stars);
        s.setAttribute("aria-label", c.stars + " out of 5 stars");
        h.appendChild(s);
      }
      var t = document.createElement("time"); t.textContent = c.date; h.appendChild(t);
      var p = document.createElement("p"); p.textContent = c.text;
      d.appendChild(h); d.appendChild(p); list.appendChild(d);
    });
  }
  function load() {
    call({ action: "list" })
      .then(function (r) { if (r.ok) render(r); })
      .catch(function () { list.textContent = "Comments could not be loaded right now."; });
  }

  likeBtn.addEventListener("click", function () {
    var on = !getLiked(), n = Number(likeCount.textContent) || 0;
    setLiked(on);
    paintLike(Math.max(0, n + (on ? 1 : -1)), on);
    call({ action: "like", delta: on ? 1 : -1 })
      .then(function (r) { if (r.ok) paintLike(r.likes, on); })
      .catch(function () {});
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = new FormData(form), o = { action: "comment" };
    d.forEach(function (v, k) { o[k] = v; });
    var btn = form.querySelector("button");
    btn.disabled = true; msg.textContent = "Sending\u2026";
    call(o).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { msg.textContent = r.error || "Something went wrong. Please try again."; return; }
      form.reset();
      msg.textContent = r.pending
        ? "Thank you! Your comment will appear after it is approved."
        : "Thank you! Your comment is posted.";
      if (!r.pending) load();
    }).catch(function () {
      btn.disabled = false;
      msg.textContent = "Could not send. Please try again.";
    });
  });
  load();
})();
