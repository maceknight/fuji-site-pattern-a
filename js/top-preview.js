(() => {
    const media = document.querySelector('.preview-media');
    if (!media) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const controls = media.querySelector('.preview-media-controls');
    const video = media.querySelector('video');

    if (video) {
        const button = controls.querySelector('[data-video-toggle]');
        const play = () => {
            if (!video.hasAttribute('src')) video.src = video.dataset.source;
            video.play().catch(() => {});
        };
        button.addEventListener('click', () => video.paused ? play() : video.pause());
        video.addEventListener('play', () => { button.textContent = '動画を停止'; });
        video.addEventListener('pause', () => { button.textContent = '動画を再生'; });
        motion.addEventListener('change', ({ matches }) => { if (matches) video.pause(); });
        controls.hidden = false;
        if (!motion.matches) play();
        return;
    }

    const slides = [...media.querySelectorAll('.preview-slide')];
    if (slides.length < 2) return;

    const counter = controls.querySelector('[data-slide-number]');
    const toggle = controls.querySelector('[data-slide-toggle]');
    let index = 0;
    let timer;

    function show(next) {
        index = (next + slides.length) % slides.length;
        slides.forEach((slide, i) => {
            slide.classList.toggle('is-current', i === index);
            slide.setAttribute('aria-hidden', String(i !== index));
        });
        counter.textContent = `${index + 1} / ${slides.length}`;
    }

    function setPlaying(playing) {
        window.clearInterval(timer);
        timer = playing ? window.setInterval(() => show(index + 1), 6500) : undefined;
        toggle.textContent = playing ? '切り替えを停止' : '切り替えを再開';
    }

    controls.querySelector('[data-prev]').addEventListener('click', () => {
        setPlaying(false);
        show(index - 1);
    });
    controls.querySelector('[data-next]').addEventListener('click', () => {
        setPlaying(false);
        show(index + 1);
    });
    toggle.addEventListener('click', () => setPlaying(timer === undefined));
    motion.addEventListener('change', ({ matches }) => { if (matches) setPlaying(false); });
    setPlaying(!motion.matches);
    controls.hidden = false;
})();
