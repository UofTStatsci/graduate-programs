/* ==========================================================
   U of T Statistical Sciences
   Alumni Country Globe

   Behaviour:
   - White interactive orthographic globe
   - One point per country
   - One connection from Toronto per country
   - Point size reflects alumni count
   - Arc weight reflects alumni count
   - 12K+ Alumni / 47 Countries / 212+ Destinations
   - Slow automatic rotation when idle
   - Drag to rotate
   - Hover pauses rotation and shows country + alumni count
   ========================================================== */

(() => {
  "use strict";


  /* ==========================================================
     ELEMENTS
     ========================================================== */

  const container =
    document.getElementById("alumni-globe");

  const canvas =
    document.getElementById("globe-canvas");

  const tooltip =
    document.getElementById("globe-tooltip");


  if (
    !container ||
    !canvas ||
    typeof d3 === "undefined" ||
    typeof topojson === "undefined"
  ) {

    console.warn(
      "Alumni globe: required element or library not found."
    );

    return;
  }


  const context =
    canvas.getContext("2d");


  /* ==========================================================
     COLOURS
     ========================================================== */

  const COLORS = {

    ocean:
      "#ffffff",

    land:
      "#d9e8ed",

    blue:
      "#0180a5",

    darkBlue:
      "#071b33",

    landOutline:
      "rgba(1,128,165,0.55)",

    graticule:
      "rgba(1,128,165,0.16)",

    arcMinimum:
      0.18,

    arcMaximum:
      0.82

  };


  /* ==========================================================
     TORONTO ORIGIN
     ========================================================== */

  const TORONTO = {

    name:
      "Toronto",

    coordinates: [
      -79.3832,
      43.6532
    ]

  };


  /* ==========================================================
     STATE
     ========================================================== */

  let width = 0;
  let height = 0;
  let dpr = 1;

  let land = null;

  let countries = [];

  let hoveredCountry = null;


  /*
   * Start with North America visible.
   */

  let rotation = [
    79,
    -28,
    0
  ];


  /* ==========================================================
     AUTO ROTATION
     ========================================================== */

  let autoRotate =
    true;

  let isDragging =
    false;

  let animationFrame =
    null;

  let lastFrameTime =
    null;


  /*
   * Degrees per second.
   */

  const AUTO_ROTATE_SPEED =
    2.2;


  /* ==========================================================
     DATA SCALES
     ========================================================== */

  let countryRadiusScale =
    () => 5;

  let arcWidthScale =
    () => 1;

  let arcOpacityScale =
    () => 0.4;


  /* ==========================================================
     PROJECTION
     ========================================================== */

  const projection =
    d3
      .geoOrthographic()

      .clipAngle(90)

      .precision(0.4);


  const path =
    d3.geoPath(
      projection,
      context
    );


  /* ==========================================================
     LOAD DATA
     ========================================================== */

  async function loadData() {


    /* --------------------------------------------------------
       WORLD LAND
       -------------------------------------------------------- */

    const worldResponse =
      await fetch(
        "assets/data/land-110m.json"
      );


    if (!worldResponse.ok) {

      throw new Error(
        "Unable to load assets/data/land-110m.json"
      );

    }


    const worldData =
      await worldResponse.json();


    land =
      topojson.feature(
        worldData,
        worldData.objects.land
      );


    /* --------------------------------------------------------
       ALUMNI COUNTRIES
       -------------------------------------------------------- */

    try {

      const countryResponse =
        await fetch(
          "assets/data/alumni-countries.json"
        );


      if (!countryResponse.ok) {

        throw new Error(
          "alumni-countries.json not found"
        );

      }


      const countryData =
        await countryResponse.json();


      countries =
        countryData

          .filter(
            d =>
              Number.isFinite(
                Number(d.longitude)
              ) &&
              Number.isFinite(
                Number(d.latitude)
              )
          )

          .map(
            d => ({

              country:
                d.country,

              longitude:
                Number(d.longitude),

              latitude:
                Number(d.latitude),

              count:
                Math.max(
                  1,
                  Number(d.count) || 1
                )

            })
          );


      console.log(
        `Alumni globe: loaded ${countries.length} countries.`
      );


    } catch (error) {

      /*
       * Earth still renders if the country data
       * hasn't been added yet.
       */

      console.warn(
        "Alumni country data unavailable. Rendering globe without alumni locations.",
        error
      );


      countries = [];

    }


    configureDataScales();

    updateStats();
  }


  /* ==========================================================
     DATA SCALES
     ========================================================== */

  function configureDataScales() {

    if (!countries.length) {

      countryRadiusScale =
        () => 5;


      arcWidthScale =
        () => 1;


      arcOpacityScale =
        () => 0.4;


      return;
    }


    const maxCount =
      d3.max(
        countries,
        d => d.count
      ) || 1;


    /* --------------------------------------------------------
       Country point size

       Points are intentionally larger than the previous
       city-level version because there are far fewer
       locations on the globe.
       -------------------------------------------------------- */

    countryRadiusScale =
      d3
        .scaleSqrt()

        .domain([
          1,
          Math.max(
            2,
            maxCount
          )
        ])

        .range([
          5,
          16
        ])

        .clamp(true);


    /* --------------------------------------------------------
       Arc width
       -------------------------------------------------------- */

    arcWidthScale =
      d3
        .scaleLog()

        .domain([
          1,
          Math.max(
            2,
            maxCount
          )
        ])

        .range([
          0.75,
          3.2
        ])

        .clamp(true);


    /* --------------------------------------------------------
       Arc opacity
       -------------------------------------------------------- */

    arcOpacityScale =
      d3
        .scaleLog()

        .domain([
          1,
          Math.max(
            2,
            maxCount
          )
        ])

        .range([
          COLORS.arcMinimum,
          COLORS.arcMaximum
        ])

        .clamp(true);

  }


  /* ==========================================================
     FIXED STATISTICS
     ========================================================== */

  function updateStats() {

    const alumniElement =
      document.getElementById(
        "alumni-total"
      );

    const cityElement =
      document.getElementById(
        "city-total"
      );

    const countryElement =
      document.getElementById(
        "country-total"
      );


    /*
     * These are presentation statistics for the
     * overall alumni community.

     * They are intentionally independent of how many
     * records are currently represented in the JSON.
     */

    if (alumniElement) {

      alumniElement.textContent =
        "12K+";

    }


    /*
     * We retain the existing ID so index.html does not
     * need structural changes.

     * It now displays Destinations.
     */

    if (cityElement) {

      cityElement.textContent =
        "212+";

    }


    if (countryElement) {

      countryElement.textContent =
        "47";

    }

  }


  /* ==========================================================
     RESIZE
     ========================================================== */

  function resize() {

    const rect =
      container.getBoundingClientRect();


    width =
      Math.max(
        1,
        rect.width
      );


    height =
      Math.max(
        1,
        rect.height
      );


    dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );


    canvas.width =
      Math.round(
        width * dpr
      );


    canvas.height =
      Math.round(
        height * dpr
      );


    canvas.style.width =
      `${width}px`;


    canvas.style.height =
      `${height}px`;


    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    projection

      .translate([
        width / 2,
        height / 2
      ])

      .scale(
        Math.min(
          width,
          height
        ) * 0.43
      )

      .rotate(
        rotation
      );


    draw();
  }


  /* ==========================================================
     VISIBILITY
     ========================================================== */

  function isVisible(
    longitude,
    latitude
  ) {

    const center =
      projection.invert([
        width / 2,
        height / 2
      ]);


    if (!center) {

      return false;

    }


    return (
      d3.geoDistance(
        center,
        [
          longitude,
          latitude
        ]
      ) <
      Math.PI / 2
    );
  }


  /* ==========================================================
     CANADA CHECK
     ========================================================== */

  function isCanada(
    country
  ) {

    const name =
      String(
        country.country || ""
      )
        .trim()
        .toLowerCase();


    return (
      name === "canada" ||
      name === "ca"
    );
  }


  /* ==========================================================
     DRAW TORONTO → COUNTRY ARC
     ========================================================== */

  function drawArc(
    destination
  ) {

    /*
     * Canada gets a country point, but no Toronto → Canada
     * arc because Toronto itself is already in Canada.
     */

    if (
      isCanada(
        destination
      )
    ) {

      return;

    }


    /*
     * Only draw destination arcs while that country
     * is on the visible hemisphere.
     */

    if (
      !isVisible(
        destination.longitude,
        destination.latitude
      )
    ) {

      return;

    }


    const start =
      TORONTO.coordinates;


    const end = [
      destination.longitude,
      destination.latitude
    ];


    const projectedStart =
      projection(
        start
      );


    const projectedEnd =
      projection(
        end
      );


    if (
      !projectedStart ||
      !projectedEnd
    ) {

      return;

    }


    /* --------------------------------------------------------
       Geographic interpolation
       -------------------------------------------------------- */

    const interpolate =
      d3.geoInterpolate(
        start,
        end
      );


    const steps =
      60;


    const points =
      d3
        .range(
          steps + 1
        )

        .map(
          i =>
            interpolate(
              i / steps
            )
        );


    /* --------------------------------------------------------
       Arc height
       -------------------------------------------------------- */

    const dx =
      projectedEnd[0] -
      projectedStart[0];


    const dy =
      projectedEnd[1] -
      projectedStart[1];


    const screenDistance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );


    const lift =
      Math.min(
        120,
        screenDistance * 0.24
      );


    /* --------------------------------------------------------
       Draw
       -------------------------------------------------------- */

    context.beginPath();


    let started =
      false;


    for (
      let i = 0;
      i < points.length;
      i++
    ) {

      const geographicPoint =
        points[i];


      /*
       * Clip arc segments behind the globe.
       */

      if (
        !isVisible(
          geographicPoint[0],
          geographicPoint[1]
        )
      ) {

        started =
          false;

        continue;

      }


      const point =
        projection(
          geographicPoint
        );


      if (!point) {

        continue;

      }


      const t =
        i /
        (points.length - 1);


      /*
       * Parabolic elevation.

       * 0 at origin
       * 1 at midpoint
       * 0 at destination
       */

      const arcHeight =
        4 *
        t *
        (1 - t) *
        lift;


      const x =
        point[0];


      const y =
        point[1] -
        arcHeight;


      if (!started) {

        context.moveTo(
          x,
          y
        );


        started =
          true;

      } else {

        context.lineTo(
          x,
          y
        );

      }

    }


    /* --------------------------------------------------------
       Alumni-count styling
       -------------------------------------------------------- */

    const highlighted =
      hoveredCountry === destination;


    const count =
      Math.max(
        1,
        destination.count
      );


    const lineWidth =
      arcWidthScale(
        count
      );


    const opacity =
      arcOpacityScale(
        count
      );


    context.strokeStyle =
      highlighted
        ? "rgba(1,128,165,1)"
        : `rgba(1,128,165,${opacity})`;


    context.lineWidth =
      highlighted
        ? Math.max(
            3,
            lineWidth + 1.25
          )
        : lineWidth;


    context.stroke();
  }


  /* ==========================================================
     DRAW COUNTRY POINT
     ========================================================== */

  function drawCountry(
    country
  ) {

    if (
      !isVisible(
        country.longitude,
        country.latitude
      )
    ) {

      return;

    }


    const point =
      projection([
        country.longitude,
        country.latitude
      ]);


    if (!point) {

      return;

    }


    const radius =
      countryRadiusScale(
        country.count
      );


    const highlighted =
      hoveredCountry === country;


    /* --------------------------------------------------------
       Optional halo
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      point[0],
      point[1],

      highlighted
        ? radius + 6
        : radius + 3,

      0,
      Math.PI * 2
    );


    context.fillStyle =
      highlighted
        ? "rgba(1,128,165,0.18)"
        : "rgba(1,128,165,0.10)";


    context.fill();


    /* --------------------------------------------------------
       Main point
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      point[0],
      point[1],

      highlighted
        ? radius + 2
        : radius,

      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.blue;


    context.fill();


    /* --------------------------------------------------------
       White outline
       -------------------------------------------------------- */

    context.strokeStyle =
      COLORS.ocean;


    context.lineWidth =
      highlighted
        ? 2.5
        : 1.25;


    context.stroke();
  }


  /* ==========================================================
     DRAW TORONTO ORIGIN
     ========================================================== */

  function drawToronto() {

    if (
      !isVisible(
        TORONTO.coordinates[0],
        TORONTO.coordinates[1]
      )
    ) {

      return;

    }


    const toronto =
      projection(
        TORONTO.coordinates
      );


    if (!toronto) {

      return;

    }


    /* --------------------------------------------------------
       Halo
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      14,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      "rgba(1,128,165,0.15)";


    context.fill();


    /* --------------------------------------------------------
       Origin
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      9,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.darkBlue;


    context.fill();


    context.strokeStyle =
      COLORS.blue;


    context.lineWidth =
      3;


    context.stroke();


    /* --------------------------------------------------------
       Inner point
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      3,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.ocean;


    context.fill();
  }


  /* ==========================================================
     DRAW GLOBE
     ========================================================== */

  function draw() {

    if (!land) {

      return;

    }


    context.clearRect(
      0,
      0,
      width,
      height
    );


    projection.rotate(
      rotation
    );


    /* ========================================================
       WHITE SPHERE
       ======================================================== */

    context.beginPath();


    path({
      type: "Sphere"
    });


    context.fillStyle =
      COLORS.ocean;


    context.fill();


    /* ========================================================
       LAND
       ======================================================== */

    context.beginPath();


    path(
      land
    );


    context.fillStyle =
      COLORS.land;


    context.fill();


    context.strokeStyle =
      COLORS.landOutline;


    context.lineWidth =
      0.55;


    context.stroke();


    /* ========================================================
       GRATICULE
       ======================================================== */

    context.beginPath();


    path(
      d3.geoGraticule10()
    );


    context.strokeStyle =
      COLORS.graticule;


    context.lineWidth =
      0.5;


    context.stroke();


    /* ========================================================
       COUNTRY CONNECTIONS
       ======================================================== */

    for (
      const country
      of countries
    ) {

      drawArc(
        country
      );

    }


    /* ========================================================
       COUNTRY POINTS
       ======================================================== */

    for (
      const country
      of countries
    ) {

      drawCountry(
        country
      );

    }


    /* ========================================================
       TORONTO
       ======================================================== */

    drawToronto();


    /* ========================================================
       GLOBE EDGE
       ======================================================== */

    context.beginPath();


    path({
      type: "Sphere"
    });


    context.strokeStyle =
      "rgba(255,255,255,0.95)";


    context.lineWidth =
      1.25;


    context.stroke();
  }


  /* ==========================================================
     AUTO ROTATION
     ========================================================== */

  function animate(
    timestamp
  ) {

    if (
      lastFrameTime === null
    ) {

      lastFrameTime =
        timestamp;

    }


    const delta =
      Math.min(
        50,
        timestamp -
        lastFrameTime
      );


    lastFrameTime =
      timestamp;


    if (
      autoRotate &&
      !isDragging &&
      !hoveredCountry
    ) {

      rotation[0] +=
        AUTO_ROTATE_SPEED *
        (delta / 1000);


      if (
        rotation[0] > 360
      ) {

        rotation[0] -=
          360;

      }


      projection.rotate(
        rotation
      );


      draw();
    }


    animationFrame =
      requestAnimationFrame(
        animate
      );
  }


  /* ==========================================================
     DRAG TO ROTATE
     ========================================================== */

  const drag =
    d3
      .drag()


      .on(
        "start",
        () => {

          isDragging =
            true;


          autoRotate =
            false;


          canvas.style.cursor =
            "grabbing";

        }
      )


      .on(
        "drag",
        event => {

          rotation[0] +=
            event.dx *
            0.35;


          rotation[1] -=
            event.dy *
            0.35;


          rotation[1] =
            Math.max(
              -90,
              Math.min(
                90,
                rotation[1]
              )
            );


          projection.rotate(
            rotation
          );


          hoveredCountry =
            null;


          hideTooltip();


          draw();

        }
      )


      .on(
        "end",
        () => {

          isDragging =
            false;


          autoRotate =
            true;


          lastFrameTime =
            null;


          canvas.style.cursor =
            "grab";

        }
      );


  /* ==========================================================
     COUNTRY HOVER
     ========================================================== */

  function pointerMoved(
    event
  ) {

    if (!countries.length) {

      return;

    }


    const rect =
      canvas.getBoundingClientRect();


    const mouseX =
      event.clientX -
      rect.left;


    const mouseY =
      event.clientY -
      rect.top;


    let closest =
      null;


    let closestDistance =
      Infinity;


    for (
      const country
      of countries
    ) {

      if (
        !isVisible(
          country.longitude,
          country.latitude
        )
      ) {

        continue;

      }


      const point =
        projection([
          country.longitude,
          country.latitude
        ]);


      if (!point) {

        continue;

      }


      const dx =
        point[0] -
        mouseX;


      const dy =
        point[1] -
        mouseY;


      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy
        );


      const hitRadius =
        Math.max(
          18,
          countryRadiusScale(
            country.count
          ) + 9
        );


      if (
        distance < hitRadius &&
        distance < closestDistance
      ) {

        closest =
          country;


        closestDistance =
          distance;

      }

    }


    hoveredCountry =
      closest;


    if (closest) {

      autoRotate =
        false;


      showTooltip(
        closest,
        mouseX,
        mouseY
      );

    } else if (
      !isDragging
    ) {

      autoRotate =
        true;


      hideTooltip();

    }


    draw();
  }


  /* ==========================================================
     TOOLTIP
     ========================================================== */

  function showTooltip(
    country,
    x,
    y
  ) {

    tooltip.innerHTML =
      `
        <strong>
          ${country.country}
        </strong>

        <span>
          ${country.count.toLocaleString()}
          ${country.count === 1
            ? " alumnus"
            : " alumni"}
        </span>
      `;


    tooltip.style.left =
      `${x}px`;


    tooltip.style.top =
      `${y}px`;


    tooltip.style.opacity =
      "1";


    tooltip.setAttribute(
      "aria-hidden",
      "false"
    );
  }


  function hideTooltip() {

    tooltip.style.opacity =
      "0";


    tooltip.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  /* ==========================================================
     RESIZE
     ========================================================== */

  let resizeTimer =
    null;


  function handleResize() {

    clearTimeout(
      resizeTimer
    );


    resizeTimer =
      setTimeout(
        resize,
        100
      );
  }


  /* ==========================================================
     REDUCED MOTION
     ========================================================== */

  function prefersReducedMotion() {

    return window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }


  /* ==========================================================
     INITIALIZE
     ========================================================== */

  async function init() {

    try {

      await loadData();


      resize();


      /* ------------------------------------------------------
         Drag
         ------------------------------------------------------ */

      d3
        .select(canvas)

        .call(
          drag
        );


      /* ------------------------------------------------------
         Hover
         ------------------------------------------------------ */

      canvas.addEventListener(
        "pointermove",
        pointerMoved
      );


      canvas.addEventListener(
        "pointerleave",
        () => {

          hoveredCountry =
            null;


          autoRotate =
            true;


          lastFrameTime =
            null;


          hideTooltip();


          draw();

        }
      );


      /* ------------------------------------------------------
         Resize
         ------------------------------------------------------ */

      window.addEventListener(
        "resize",
        handleResize,
        {
          passive: true
        }
      );


      /* ------------------------------------------------------
         Ambient rotation
         ------------------------------------------------------ */

      if (
        !prefersReducedMotion()
      ) {

        animationFrame =
          requestAnimationFrame(
            animate
          );

      }


    } catch (error) {

      console.error(
        "Unable to load alumni globe:",
        error
      );

    }
  }


  /* ==========================================================
     START
     ========================================================== */

  init();

})();
