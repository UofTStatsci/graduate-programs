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
     DATA SCALES
     ========================================================== */

  let cityRadiusScale =
    () => 2;

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
     render while alumni-cities.json is being developed.
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

      /*
       * Missing alumni data should NOT prevent
       * the globe from appearing.
       */

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

     The alumni distribution will be extremely uneven.

     We therefore avoid linear scaling.

     CITY SIZE:
     square-root scale

     ARC WIDTH:
     logarithmic scale

     ARC OPACITY:
     logarithmic scale
     ========================================================== */

  function configureDataScales() {

    if (!alumni.length) {

      cityRadiusScale =
        () => 2;


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

       1 alumnus:
       approximately 1.6px

       Largest city:
       approximately 8px
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
          1.6,
          8
        ])

        .clamp(true);


    /* --------------------------------------------------------
       Arc width

       Small locations remain visible while major alumni
       centres receive greater visual weight.
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
     * Until alumni-cities.json exists, retain the
     * brochure's existing 12K+ figure rather than
     * replacing it with zero.
     */

    if (!alumni.length) {

      if (cityElement) {
        cityElement.textContent = "—";
      }


      if (countryElement) {
        countryElement.textContent = "—";
      }


      return;
    }


    const alumniTotal =
      d3.sum(
        alumni,
        d => d.count
      );


    const countries =
      new Set(
        alumni

          .map(
            d => d.country
          )

          .filter(Boolean)
      );


    if (alumniElement) {

      alumniElement.textContent =
        alumniTotal.toLocaleString();

    }


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


    /* --------------------------------------------------------
       HiDPI scaling
       -------------------------------------------------------- */

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    /* --------------------------------------------------------
       Globe projection
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

     Returns true when a geographic coordinate is
     on the visible hemisphere.
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

     Each CITY receives one connection.

     We do NOT draw one line per alumnus.

     Alumni count is encoded using:
     - line width
     - line opacity
     ========================================================== */

  function drawArc(
    destination
  ) {

    /*
     * Toronto doesn't need a connection to itself.
     */

    if (
      isToronto(
        destination
      )
    ) {
      return;
    }


    /*
     * Don't draw destinations on the back hemisphere.
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
       Determine visual arc height
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


    /*
     * Longer geographic connections rise farther
     * from the globe.
     */

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
       * Hide sections passing behind the globe.
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
       * Parabolic lift:
       *
       * 4t(1-t)
       *
       * = 0 at both endpoints
       * = 1 at midpoint
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


    /* ========================================================
       COUNT-WEIGHTED ARC STYLE
       ======================================================== */

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


    /*
     * Square-root scale keeps major cities prominent
     * without allowing Toronto/GTA concentrations to
     * visually overwhelm the globe.
     */

    const radius =
      cityRadiusScale(
        count
      );


    const highlighted =
      hoveredCity === city;


    /* --------------------------------------------------------
       City circle
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       White outline
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       Outer origin marker
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      7,
      0,
      Math.PI * 2
    );


    context.fillStyle =
      COLORS.darkBlue;


    context.fill();


    context.strokeStyle =
      COLORS.blue;


    context.lineWidth =
      2.5;


    context.stroke();


    /* --------------------------------------------------------
       Inner marker
       -------------------------------------------------------- */

    context.beginPath();


    context.arc(
      toronto[0],
      toronto[1],
      2.5,
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


    /* --------------------------------------------------------
       Clear
       -------------------------------------------------------- */

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
       WHITE SPHERE / OCEAN
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
       CONNECTIONS

       Draw strings underneath the city dots.
       ======================================================== */

    for (
      const city
      of alumni
    ) {

      drawArc(
        city
      );

    }


    /* ========================================================
       CITY NODES
       ======================================================== */

    for (
      const city
      of alumni
    ) {

      drawCity(
        city
      );

    }


    /* ========================================================
       TORONTO ORIGIN

       Draw after all city nodes so the origin remains
       visually prominent.
       ======================================================== */

    drawToronto();


    /* ========================================================
       OUTER GLOBE EDGE
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

    /*
     * No city lookup is necessary if alumni data
     * hasn't been loaded yet.
     */

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


    /*
     * Minimum hover target size.

     * Even tiny one-alumnus city nodes remain reasonably
     * easy to interact with.
     */

    let closestDistance =
      15;


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
       * Larger alumni hubs get a slightly larger
       * interactive hit area.
       */

      const hitRadius =
        Math.max(
          15,
          cityRadiusScale(
            city.count
          ) + 7
        );


      if (
        distance <
        closestDistance ||
        (
          closest === null &&
          distance < hitRadius
        )
      ) {

        closest =
          city;


        closestDistance =
          distance;

      }

    }


    hoveredCity =
      closest;


    if (closest) {

      showTooltip(
        closest,
        mouseX,
        mouseY
      );

    } else {

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
