/* ==========================================================
   U of T Statistical Sciences
   Alumni Globe

   Interactive orthographic globe with connections
   from Toronto to alumni cities.

   Visual treatment:
   - White globe
   - Pale blue land
   - U of T blue geographic details
   - Blue alumni nodes and arcs
   - Drag to rotate
   - Hover cities for alumni counts
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

    arc:
      "rgba(1,128,165,0.42)",

    arcHover:
      "rgba(1,128,165,1)"

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
   * Initial globe rotation.
   *
   * Positions North America prominently when the
   * visualization first loads.
   */

  let rotation = [
    79,
    -28,
    0
  ];


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

    const [
      worldData,
      alumniData
    ] =
      await Promise.all([

        fetch(
          "assets/data/land-110m.json"
        )
          .then(
            response => {

              if (!response.ok) {
                throw new Error(
                  "Unable to load land-110m.json"
                );
              }

              return response.json();
            }
          ),


        fetch(
          "assets/data/alumni-cities.json"
        )
          .then(
            response => {

              if (!response.ok) {
                throw new Error(
                  "Unable to load alumni-cities.json"
                );
              }

              return response.json();
            }
          )

      ]);


    /* --------------------------------------------------------
       Convert TopoJSON to GeoJSON
       -------------------------------------------------------- */

    land =
      topojson.feature(
        worldData,
        worldData.objects.land
      );


    /* --------------------------------------------------------
       Validate alumni coordinates
       -------------------------------------------------------- */

    alumni =
      alumniData.filter(
        d =>
          Number.isFinite(
            Number(d.longitude)
          ) &&
          Number.isFinite(
            Number(d.latitude)
          )
      );


    /*
     * Ensure numeric values are actually numbers.
     */

    alumni =
      alumni.map(
        d => ({

          ...d,

          longitude:
            Number(d.longitude),

          latitude:
            Number(d.latitude),

          count:
            Number(d.count) || 0

        })
      );


    updateStats();
  }


  /* ==========================================================
     ALUMNI STATS
     ========================================================== */

  function updateStats() {

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


    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    /* --------------------------------------------------------
       Projection
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
     POINT VISIBILITY

     Determines whether a city is on the visible hemisphere.
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
     DRAW CONNECTION ARC
     ========================================================== */

  function drawArc(
    destination
  ) {

    /*
     * Don't draw an arc if its destination is on
     * the back side of the globe.
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

       Creates the geographic path between Toronto
       and the destination.
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


    /*
     * Longer connections rise higher from the globe.
     */

    const lift =
      Math.min(
        105,
        screenDistance * 0.22
      );


    /* --------------------------------------------------------
       Draw string
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
       * Skip portions that pass behind the globe.
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
       * Parabolic curve:
       *
       * 4t(1-t)
       *
       * t = 0     → 0
       * t = .5    → 1
       * t = 1     → 0
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
       Arc appearance
       -------------------------------------------------------- */

    const highlighted =
      hoveredCity === destination;


    context.strokeStyle =
      highlighted
        ? COLORS.arcHover
        : COLORS.arc;


    context.lineWidth =
      highlighted
        ? 2
        : 0.9;


    context.stroke();
  }


  /* ==========================================================
     DRAW GLOBE
     ========================================================== */

  function draw() {

    if (!land) {
      return;
    }


    /* --------------------------------------------------------
       Clear canvas
       -------------------------------------------------------- */

    context.clearRect(
      0,
      0,
      width,
      height
    );


    /* --------------------------------------------------------
       Apply current rotation
       -------------------------------------------------------- */

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
       ALUMNI CONNECTIONS
       ======================================================== */

    for (
      const city
      of alumni
    ) {

      /*
       * Don't draw a Toronto → Toronto connection.
       */

      const isToronto =
        Math.abs(
          city.longitude -
          TORONTO.coordinates[0]
        ) < 0.05 &&
        Math.abs(
          city.latitude -
          TORONTO.coordinates[1]
        ) < 0.05;


      if (!isToronto) {

        drawArc(
          city
        );

      }

    }


    /* ========================================================
       ALUMNI CITY DOTS
       ======================================================== */

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


      /*
       * Alumni count controls dot size.

       * Square root prevents cities with very large
       * populations from dominating the globe.
       */

      const radius =
        Math.min(
          7,
          1.5 +
          Math.sqrt(
            city.count
          ) *
          0.18
        );


      const highlighted =
        hoveredCity === city;


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


      /*
       * White outline improves separation where many
       * cities are geographically close together.
       */

      context.strokeStyle =
        COLORS.ocean;


      context.lineWidth =
        highlighted
          ? 2
          : 0.8;


      context.stroke();
    }


    /* ========================================================
       TORONTO ORIGIN
       ======================================================== */

    if (
      isVisible(
        TORONTO.coordinates[0],
        TORONTO.coordinates[1]
      )
    ) {

      const toronto =
        projection(
          TORONTO.coordinates
        );


      /* ------------------------------------------------------
         Outer Toronto ring
         ------------------------------------------------------ */

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


      /* ------------------------------------------------------
         Inner Toronto point
         ------------------------------------------------------ */

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


    /* ========================================================
       OUTER GLOBE OUTLINE

       Draw last so the sphere has a crisp edge.
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
         Drag start
         ------------------------------------------------------ */

      .on(
        "start",
        () => {

          canvas.style.cursor =
            "grabbing";

        }
      )


      /* ------------------------------------------------------
         Drag
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
           * Prevent flipping over the poles.
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
         Drag end
         ------------------------------------------------------ */

      .on(
        "end",
        () => {

          canvas.style.cursor =
            "grab";

        }
      );


  /* ==========================================================
     CITY HOVER
     ========================================================== */

  function pointerMoved(
    event
  ) {

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
     * Hover hit area.
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


      if (
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
     INITIALIZE
     ========================================================== */

  async function init() {

    try {

      /* ------------------------------------------------------
         Load geographic + alumni data
         ------------------------------------------------------ */

      await loadData();


      /* ------------------------------------------------------
         Size and draw globe
         ------------------------------------------------------ */

      resize();


      /* ------------------------------------------------------
         Enable rotation
         ------------------------------------------------------ */

      d3
        .select(canvas)
        .call(
          drag
        );


      /* ------------------------------------------------------
         City hover
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
         Responsive resize
         ------------------------------------------------------ */

      window.addEventListener(
        "resize",
        resize,
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
