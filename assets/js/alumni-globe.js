/* ==========================================================
   U of T Statistical Sciences
   Alumni Destinations Globe

   Simplified visualization.

   Behaviour:
   - Uses the existing working alumni-cities.json
   - Cities are treated only as anonymous destinations
   - No city names are displayed
   - No alumni counts are displayed
   - No hover cards
   - All destination points have equal visual weight
   - One connection per destination
   - Toronto is the origin
   - Slow automatic rotation when idle
   - Drag to rotate
   - White globe with U of T blue data
   ========================================================== */

(() => {
  "use strict";


  /* ==========================================================
     ELEMENTS
     ========================================================== */

  const container =
    document.getElementById(
      "alumni-globe"
    );


  const canvas =
    document.getElementById(
      "globe-canvas"
    );


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

    arc:
      "rgba(1,128,165,0.34)",

    pointHalo:
      "rgba(1,128,165,0.16)"

  };


  /* ==========================================================
     TORONTO ORIGIN
     ========================================================== */

  const TORONTO = {

    coordinates: [
      -79.3832,
      43.6532
    ]

  };


  /* ==========================================================
     VISUAL SETTINGS
     ========================================================== */

  /*
   * Every destination receives the same visual weight.
   */

  const DESTINATION_RADIUS =
    4.25;


  const DESTINATION_HALO_RADIUS =
    7;


  const ARC_WIDTH =
    0.9;


  /*
   * Toronto remains more prominent than destination points.
   */

  const TORONTO_RADIUS =
    8;


  const TORONTO_HALO_RADIUS =
    13;


  /* ==========================================================
     STATE
     ========================================================== */

  let width = 0;

  let height = 0;

  let dpr = 1;


  let land =
    null;


  let destinations =
    [];


  /*
   * Start with North America prominent.
   */

  let rotation = [
    79,
    -28,
    0
  ];


  /* ==========================================================
     AUTO ROTATION
     ========================================================== */

  let isDragging =
    false;


  let animationFrame =
    null;


  let lastFrameTime =
    null;


  /*
   * Degrees per second.
   *
   * Deliberately subtle.
   */

  const AUTO_ROTATE_SPEED =
    2.2;


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
       World geography
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
       Anonymous destinations

       We deliberately ignore:
       - city name
       - province
       - country label
       - alumni count

       Only coordinates are used by the visualization.
       -------------------------------------------------------- */

    try {

      const destinationResponse =
        await fetch(
          "assets/data/alumni-cities.json"
        );


      if (!destinationResponse.ok) {

        throw new Error(
          "alumni-cities.json not found"
        );

      }


      const destinationData =
        await destinationResponse.json();


      destinations =
        destinationData

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

              longitude:
                Number(d.longitude),

              latitude:
                Number(d.latitude)

            })
          );


      console.log(
        `Alumni globe: loaded ${destinations.length} anonymous destinations.`
      );


    } catch (error) {

      /*
       * Globe still renders without destination data.
       */

      console.warn(
        "Destination data unavailable. Rendering globe without destination points.",
        error
      );


      destinations = [];

    }


    updateStats();
  }


  /* ==========================================================
     FIXED STATISTICS
     ========================================================== */

  function updateStats() {

    const alumniElement =
      document.getElementById(
        "alumni-total"
      );


    const countryElement =
      document.getElementById(
        "country-total"
      );


    const destinationElement =
      document.getElementById(
        "city-total"
      );


    if (alumniElement) {

      alumniElement.textContent =
        "12K+";

    }


    if (countryElement) {

      countryElement.textContent =
        "47";

    }


    if (destinationElement) {

      destinationElement.textContent =
        "212+";

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


    /* --------------------------------------------------------
       Canvas resolution
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       Globe size
       -------------------------------------------------------- */

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
    destination
  ) {

    return (
      Math.abs(
        destination.longitude -
        TORONTO.coordinates[0]
      ) < 0.05
      &&
      Math.abs(
        destination.latitude -
        TORONTO.coordinates[1]
      ) < 0.05
    );
  }


  /* ==========================================================
     DRAW DESTINATION ARC
     ========================================================== */

  function drawArc(
    destination
  ) {

    /*
     * Don't draw Toronto → Toronto.
     */

    if (
      isToronto(
        destination
      )
    ) {

      return;

    }


    /*
     * Destination must currently be visible.
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


    /* --------------------------------------------------------
       Determine arc height
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
        105,
        screenDistance * 0.22
      );


    /* --------------------------------------------------------
       Build path
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
       * Hide portions behind the globe.
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
       * Parabolic lift.
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
       Equal-weight connection
       -------------------------------------------------------- */

    context.strokeStyle =
      COLORS.arc;


    context.lineWidth =
      ARC_WIDTH;


    context.stroke();
  }


  /* ==========================================================
     DRAW DESTINATION POINT
     ========================================================== */

  function drawDestination(
    destination
  ) {

    if (
      !isVisible(
        destination.longitude,
        destination.latitude
      )
    ) {

      return;

    }


    const point =
      projection([
        destination.longitude,
        destination.latitude
      ]);


    if (!point) {

      return;

    }


    /* --------------------------------------------------------
       Halo
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      point[0],
      point[1],
      DESTINATION_HALO_RADIUS,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.pointHalo;


    context.fill();


    /* --------------------------------------------------------
       Destination point
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      point[0],
      point[1],
      DESTINATION_RADIUS,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.blue;


    context.fill();


    /* --------------------------------------------------------
       White edge
       -------------------------------------------------------- */

    context.strokeStyle =
      COLORS.ocean;


    context.lineWidth =
      1;


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


    /* --------------------------------------------------------
       Halo
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      TORONTO_HALO_RADIUS,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      "rgba(1,128,165,0.18)";


    context.fill();


    /* --------------------------------------------------------
       Toronto marker
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      TORONTO_RADIUS,
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
       Centre
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      2.75,
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
       DESTINATION CONNECTIONS
       ======================================================== */

    for (
      const destination
      of destinations
    ) {

      drawArc(
        destination
      );

    }


    /* ========================================================
       DESTINATION POINTS
       ======================================================== */

    for (
      const destination
      of destinations
    ) {

      drawDestination(
        destination
      );

    }


    /* ========================================================
       TORONTO ORIGIN
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


    /*
     * Rotate whenever the user isn't dragging.
     */

    if (
      !isDragging
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


      /* ------------------------------------------------------
         Start
         ------------------------------------------------------ */

      .on(
        "start",
        () => {

          isDragging =
            true;


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


          /*
           * Prevent pole flipping.
           */

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


          /*
           * Reset frame timing so auto-rotation resumes
           * without a jump.
           */

          lastFrameTime =
            null;


          canvas.style.cursor =
            "grab";

        }
      );


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

      /* ------------------------------------------------------
         Load world + destination data
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
