// Apple-style Dynamic In-Depth Transitions for Climbing Logbook
(function () {
  'use strict';

  var currentSlug = document.body.dataset.feature;
  var isTransitioning = false;

  function handleFeatureNavigation(targetUrl) {
    if (isTransitioning) return;
    isTransitioning = true;

    // Fetch next page in background
    fetch(targetUrl)
      .then(function (res) { return res.text(); })
      .then(function (htmlText) {
        var parser = new DOMParser();
        var newDoc = parser.parseFromString(htmlText, 'text/html');

        var newBody = newDoc.querySelector('.fp-body');
        var newVideo = newDoc.querySelector('#v');
        var newSlug = newDoc.body.dataset.feature;
        var newTitle = newDoc.title;
        var newPillNav = newDoc.querySelector('.fp-more nav');

        if (!newBody || !newVideo) {
          window.location.href = targetUrl;
          return;
        }

        // 1. Apple text blur & rise out
        var currentBody = document.querySelector('.fp-body');
        currentBody.classList.remove('fp-animate-in');
        currentBody.classList.add('fp-animate-out');

        // 2. Video crossfade: create incoming video layer
        var screenContainer = document.querySelector('.fp-screen-container');
        var oldVideo = document.querySelector('#v');

        var nextVideo = document.createElement('video');
        nextVideo.className = 'clip is-entering';
        nextVideo.muted = true;
        nextVideo.loop = true;
        nextVideo.playsInline = true;
        nextVideo.autoplay = true;
        nextVideo.preload = 'auto';
        nextVideo.poster = newVideo.poster;
        nextVideo.setAttribute('tabindex', '-1');
        nextVideo.setAttribute('aria-hidden', 'true');
        nextVideo.setAttribute('disablepictureinpicture', '');
        nextVideo.style.opacity = '0';

        var source = document.createElement('source');
        source.src = newVideo.querySelector('source').src;
        source.type = 'video/mp4';
        nextVideo.appendChild(source);

        screenContainer.appendChild(nextVideo);

        // Force browser layout pass before triggering crossfade
        void nextVideo.offsetWidth;

        oldVideo.classList.add('is-leaving');
        nextVideo.style.opacity = '1';

        // 3. Swap text after exit animation completes
        setTimeout(function () {
          currentBody.innerHTML = newBody.innerHTML;
          currentBody.classList.remove('fp-animate-out');
          currentBody.classList.add('fp-animate-in');

          // Update active pills
          if (newPillNav) {
            var currentNav = document.querySelector('.fp-more nav');
            if (currentNav) currentNav.innerHTML = newPillNav.innerHTML;
          }

          // Clean up old video
          if (oldVideo && oldVideo.parentNode) {
            oldVideo.parentNode.removeChild(oldVideo);
          }
          nextVideo.id = 'v';
          nextVideo.className = 'clip is-active';

          // Update browser history and metadata
          history.pushState({ slug: newSlug }, newTitle, targetUrl);
          document.title = newTitle;
          document.body.dataset.feature = newSlug;

          // Rebind buttons
          bindNavLinks();
          isTransitioning = false;
        }, 360);
      })
      .catch(function () {
        window.location.href = targetUrl;
      });
  }

  function bindNavLinks() {
    // Intercept Next/Prev buttons and bottom pill nav
    var links = document.querySelectorAll('.fp-nav a, .fp-more a');
    links.forEach(function (link) {
      // Don't intercept exit links back to index.html
      var href = link.getAttribute('href') || '';
      if (!href || href.indexOf('index.html') !== -1 || href.startsWith('#')) return;

      link.onclick = function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        handleFeatureNavigation(href);
      };
    });
  }

  // Handle browser back/forward buttons smoothly
  window.addEventListener('popstate', function () {
    window.location.reload();
  });

  // Reduced motion preference check
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var v = document.getElementById('v');
    if (v) {
      v.removeAttribute('autoplay');
      v.pause();
    }
  } else {
    bindNavLinks();
  }
})();
