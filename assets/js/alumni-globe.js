/* ==========================================================
   U of T Statistical Sciences
   Alumni Globe

   Interactive orthographic globe showing alumni cities.

   Behaviour:
   - White globe on dark blue background
   - Pale blue land
   - U of T blue alumni nodes and connections
   - Toronto is the origin
   - One connection per city
   - Connection weight reflects alumni count
   - City size reflects alumni count
   - Drag to rotate
   - Hover to explore city totals
   - Slowly auto-rotates when idle
   - Auto-rotation pauses during interaction
   - Globe still renders if alumni-cities.json is unavailable
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
      "rgba(1,128,165,0.18)",

    arcMinimum:
      0.16,

    arcMaximum:
      0.78

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

  let alumni = [];

  let hoveredCity = null;


  /*
   * Initial globe orientation.
   *
   * North America is prominent on load.
   */

  let rotation = [
    79,
    -28,
    0
  ];


  /* ==========================================================
     AUTO ROTATION
     ========================================================== */

  let autoRotate = true;

  let isDragging = false;

  let animationFrame = null;

  let lastFrameTime = null;


  /*
   * Degrees per second.
   *
   * A complete revolution takes roughly 2 minutes 44 seconds.
   */

  const AUTO_ROTATE_SPEED = 2.2;


  /* ==========================================================
     DATA SCALES
     ========================================================== */

  let cityRadiusScale =
    () => 4;

  let arcWidthScale =
    () => 0.75;

  let arcOpacityScale =
    () => 0.3;


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
     LOAD WORLD DATA

     World data is REQUIRED.

     Alumni data is OPTIONAL so that the globe can still
     render while alumni-cities.json is unavailable.
     ========================================================== */

  async function loadData() {


    /* --------------------------------------------------------
       WORLD DATA
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
       ALUMNI CITY DATA
       -------------------------------------------------------- */

    try {

      const alumniResponse =
        await fetch(
          "assets/data/alumni-cities.json"
        );


      if (!alumniResponse.ok) {

        throw new Error(
          "alumni-cities.json not found"
        );

      }


      const alumniData =
        await alumniResponse.json();


      alumni =
        alumniData

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

              ...d,

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
        `Alumni globe: loaded ${alumni.length} city locations.`
      );


    } catch (error) {

      console.warn(
        "Alumni city data is not available yet. Rendering globe without alumni connections.",
        error
      );


      alumni = [];

    }


    configureDataScales();

    updateStats();
  }


  /* ==========================================================
     DATA SCALES
     ========================================================== */

  function configureDataScales() {

    if (!alumni.length) {

      cityRadiusScale =
        () => 4;


      arcWidthScale =
        () => 0.75;


      arcOpacityScale =
        () => 0.3;


      return;
    }


    const maxCount =
      d3.max(
        alumni,
        d => d.count
      ) || 1;


    /* --------------------------------------------------------
       City radius

       Increased substantially from the previous version.

       Smallest city:
       approximately 3.5px

       Largest city:
       approximately 12px
       -------------------------------------------------------- */

    cityRadiusScale =
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
          3.5,
          12
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
          0.55,
          2.8
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
     ALUMNI STATS
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
     * 12K+ represents the department's entire worldwide
     * alumni community.
     *
     * It intentionally does NOT change to the number of
     * alumni currently represented in alumni-cities.json.
     */

    if (alumniElement) {

      alumniElement.textContent =
        "12K+";

    }


    if (!alumni.length) {

      if (cityElement) {
        cityElement.textContent = "—";
      }

      if (countryElement) {
        countryElement.textContent = "—";
      }

      return;
    }


    const countries =
      new Set(
        alumni
          .map(
            d => d.country
          )
          .filter(Boolean)
      );


    if (cityElement) {

      cityElement.textContent =
        alumni.length.toLocaleString();

    }


    if (countryElement) {

      countryElement.textContent =
        countries.size.toLocaleString();

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
     TORONTO CHECK
     ========================================================== */

  function isToronto(
    city
  ) {

    return (
      Math.abs(
        city.longitude -
        TORONTO.coordinates[0]
      ) < 0.05
      &&
      Math.abs(
        city.latitude -
        TORONTO.coordinates[1]
      ) < 0.05
    );
  }


  /* ==========================================================
     DRAW PARABOLIC CONNECTION
     ========================================================== */

  function drawArc(
    destination
  ) {

    if (
      isToronto(
        destination
      )
    ) {
      return;
    }


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


    const interpolate =
      d3.geoInterpolate(
        start,
        end
      );


    const steps =
      50;


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
        105,
        screenDistance * 0.22
      );


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


    const highlighted =
      hoveredCity === destination;


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
            2.5,
            lineWidth + 1
          )
        : lineWidth;


    context.stroke();
  }


  /* ==========================================================
     DRAW CITY NODE
     ========================================================== */

  function drawCity(
    city
  ) {

    if (
      !isVisible(
        city.longitude,
        city.latitude
      )
    ) {
      return;
    }


    const point =
      projection([
        city.longitude,
        city.latitude
      ]);


    if (!point) {
      return;
    }


    const count =
      Math.max(
        1,
        city.count
      );


    const radius =
      cityRadiusScale(
        count
      );


    const highlighted =
      hoveredCity === city;


    context.beginPath();


    context.arc(
      point[0],
      point[1],

      highlighted
        ? radius + 2.5
        : radius,

      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.blue;


    context.fill();


    context.strokeStyle =
      COLORS.ocean;


    context.lineWidth =
      highlighted
        ? 2
        : 0.8;


    context.stroke();
  }


  /* ==========================================================
     DRAW TORONTO
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


    /* --------------------------------------------------------
       White sphere
       -------------------------------------------------------- */

    context.beginPath();


    path({
      type: "Sphere"
    });


    context.fillStyle =
      COLORS.ocean;


    context.fill();


    /* --------------------------------------------------------
       Land
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       Graticule
       -------------------------------------------------------- */

    context.beginPath();


    path(
      d3.geoGraticule10()
    );


    context.strokeStyle =
      COLORS.graticule;


    context.lineWidth =
      0.5;


    context.stroke();


    /* --------------------------------------------------------
       Connections
       -------------------------------------------------------- */

    for (
      const city
      of alumni
    ) {

      drawArc(
        city
      );

    }


    /* --------------------------------------------------------
       City nodes
       -------------------------------------------------------- */

    for (
      const city
      of alumni
    ) {

      drawCity(
        city
      );

    }


    /* --------------------------------------------------------
       Toronto
       -------------------------------------------------------- */

    drawToronto();


    /* --------------------------------------------------------
       Globe outline
       -------------------------------------------------------- */

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
     AUTO ROTATION LOOP
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


    /*
     * Cap delta so returning to the browser tab doesn't
     * cause the globe to suddenly jump.
     */

    const delta =
      Math.min(
        50,
        timestamp -
        lastFrameTime
      );


    lastFrameTime =
      timestamp;


    /*
     * Slowly rotate only when the visitor isn't actively
     * interacting with the visualization.
     */

    if (
      autoRotate &&
      !isDragging &&
      !hoveredCity
    ) {

      rotation[0] +=
        AUTO_ROTATE_SPEED *
        (delta / 1000);


      /*
       * Prevent longitude from growing indefinitely.
       */

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


      /* ------------------------------------------------------
         Start
         ------------------------------------------------------ */

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


      /* ------------------------------------------------------
         Rotate
         ------------------------------------------------------ */

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


          hoveredCity =
            null;


          hideTooltip();


          draw();

        }
      )


      /* ------------------------------------------------------
         End
         ------------------------------------------------------ */

      .on(
        "end",
        () => {

          isDragging =
            false;


          autoRotate =
            true;


          /*
           * Reset timing so the globe resumes smoothly.
           */

          lastFrameTime =
            null;


          canvas.style.cursor =
            "grab";

        }
      );


  /* ==========================================================
     POINTER / CITY HOVER
     ========================================================== */

  function pointerMoved(
    event
  ) {

    if (!alumni.length) {
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
      const city
      of alumni
    ) {

      if (
        !isVisible(
          city.longitude,
          city.latitude
        )
      ) {
        continue;
      }


      const point =
        projection([
          city.longitude,
          city.latitude
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


      /*
       * Larger visible nodes receive larger hit targets.
       */

      const hitRadius =
        Math.max(
          16,
          cityRadiusScale(
            city.count
          ) + 8
        );


      if (
        distance <
        hitRadius &&
        distance <
        closestDistance
      ) {

        closest =
          city;


        closestDistance =
          distance;

      }

    }


    hoveredCity =
      closest;


    /*
     * Pause the ambient rotation while the visitor
     * is examining a city.
     */

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
    city,
    x,
    y
  ) {

    const locationParts = [

      city.city,

      city.province,

      city.country

    ].filter(Boolean);


    tooltip.innerHTML =
      `
        <strong>
          ${locationParts.join(", ")}
        </strong>

        <span>
          ${city.count.toLocaleString()}
          ${city.count === 1
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
     RESIZE HANDLING
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

      /* ------------------------------------------------------
         Load geographic data
         ------------------------------------------------------ */

      await loadData();


      /* ------------------------------------------------------
         Initial render
         ------------------------------------------------------ */

      resize();


      /* ------------------------------------------------------
         Drag interaction
         ------------------------------------------------------ */

      d3
        .select(canvas)

        .call(
          drag
        );


      /* ------------------------------------------------------
         Hover interaction
         ------------------------------------------------------ */

      canvas.addEventListener(
        "pointermove",
        pointerMoved
      );


      canvas.addEventListener(
        "pointerleave",
        () => {

          hoveredCity =
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
         Responsive resizing
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

         Respect the visitor's reduced-motion preference.
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
