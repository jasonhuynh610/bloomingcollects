// Travel journal data. Add a country by adding an entry; photos are built by tools/imgproc.
// No captions or locations are added unless Mushi provides them.
window.TRAVEL = [
  {
    id: "japan",
    name: "Japan",
    native: "日本",
    dir: "/travel/photos/japan/",
    photos: [{"id":"japan-001","w":2000,"h":1333},{"id":"japan-002","w":2000,"h":1334},{"id":"japan-003","w":2000,"h":1334},{"id":"japan-004","w":2000,"h":1333},{"id":"japan-005","w":2000,"h":1333},{"id":"japan-006","w":2000,"h":1334},{"id":"japan-007","w":2000,"h":1334},{"id":"japan-008","w":2000,"h":1334},{"id":"japan-009","w":2000,"h":1334},{"id":"japan-010","w":2000,"h":1334},{"id":"japan-011","w":1334,"h":2000},{"id":"japan-012","w":2000,"h":1334},{"id":"japan-013","w":2000,"h":1334},{"id":"japan-014","w":2000,"h":1334},{"id":"japan-015","w":2000,"h":1333},{"id":"japan-016","w":2000,"h":1334},{"id":"japan-017","w":2000,"h":1334},{"id":"japan-018","w":2000,"h":1333},{"id":"japan-019","w":2000,"h":1334}],
  },
  {
    id: "korea",
    name: "South Korea",
    native: "한국",
    dir: "/travel/photos/korea/",
    tile: "4/5",
    // autoplaying (muted, looping) clips, placed after the named photo
    videos: [{ after: "korea-20", src: "korea-video.mp4", poster: "korea-video-poster.webp" }],
    photos: [{"id":"korea-01","w":1280,"h":853},{"id":"korea-02","w":1280,"h":853},{"id":"korea-03","w":853,"h":1280},{"id":"korea-04","w":853,"h":1280},{"id":"korea-05","w":1280,"h":853},{"id":"korea-06","w":853,"h":1280},{"id":"korea-07","w":853,"h":1280},{"id":"korea-08","w":853,"h":1280},{"id":"korea-09","w":853,"h":1280},{"id":"korea-10","w":853,"h":1280},{"id":"korea-11","w":1280,"h":853},{"id":"korea-12","w":1280,"h":853},{"id":"korea-13","w":1280,"h":853},{"id":"korea-15","w":853,"h":1280},{"id":"korea-16","w":960,"h":1280},{"id":"korea-17","w":853,"h":1280},{"id":"korea-18","w":853,"h":1280},{"id":"korea-19","w":1280,"h":853},{"id":"korea-20","w":1280,"h":853},{"id":"korea-21","w":960,"h":1280},{"id":"korea-22","w":959,"h":1280},{"id":"korea-23","w":960,"h":1280},{"id":"korea-24","w":853,"h":1280},{"id":"korea-25","w":853,"h":1280},{"id":"korea-26","w":853,"h":1280},{"id":"korea-27","w":853,"h":1280}],
  },
];