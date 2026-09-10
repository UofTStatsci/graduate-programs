/* ==========================================================
   U of T Statistical Sciences
   Alumni Globe

   Interactive orthographic globe
   with parabolic connections from Toronto.

   Public alumni data is aggregated to CITY level only.
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
    return;
  }


  const context =
    canvas.getContext("2d");


  /* ==========================================================
     TORONTO — ORIGIN
     ========================================================== */

  const TORONTO = {
    name: "Toronto",
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
    d3
      .geoPath(
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
        ).then(
          response =>
            response.json()
        ),

        fetch(
          "assets/data/alumni-cities.json"
        ).then(
          response =>
            response.json()
        )

      ]);


    land =
      topojson.feature(
        worldData,
        worldData.objects.land
      );


    alumni =
      alumniData.filter(
        d =>
          Number.isFinite(d.longitude) &&
          Number.isFinite(d.latitude)
      );


    updateStats();
  }


  /* ==========================================================
     STATS
     ========================================================== */

  function updateStats() {

    const alumniTotal =
      d3.sum(
        alumni,
        d => d.count
      );


    const countries =
      new Set(
        alumni.map(
          d => d.country
        )
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

     Determines whether a point is currently on the
     visible hemisphere.
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
     GREAT-CIRCLE / PARABOLIC ARC
     ========================================================== */

  function drawArc(destination) {

    const start =
      TORONTO.coordinates;


    const end = [
      destination.longitude,
      destination.latitude
    ];


    /*
     * Interpolate along a geographic great-circle.
     */

    const interpolate =
      d3.geoInterpolate(
        start,
        end
      );


    const steps = 50;


    const points =
      d3.range(
        steps + 1
      ).map(
        i =>
          interpolate(
            i / steps
          )
      );


    /*
     * Project the geographic points.
     */

    const projected =
      points.map(
        point =>
          projection(
            point
          )
      );


    /*
     * Skip connections entirely behind globe.
     */

    if (
      !isVisible(
        destination.longitude,
        destination.latitude
      )
    ) {
      return;
    }


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


    /*
     * Build a screen-space parabolic lift.

     * The midpoint rises away from the globe,
     * giving the connection the appearance of
     * a string arching above the surface.
     */

    const dx =
      projectedEnd[0] -
      projectedStart[0];


    const dy =
      projectedEnd[1] -
      projectedStart[1];


    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );


    const lift =
      Math.min(
        100,
        distance * 0.22
      );


    context.beginPath();


    for (
      let i = 0;
      i < projected.length;
      i++
    ) {

      const point =
        projected[i];


      if (!point) {
        continue;
      }


      const t =
        i /
        (projected.length - 1);


      /*
       * Parabola:
       *
       * 4t(1-t)
       *
       * 0 at both endpoints
       * 1 at midpoint
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


      if (i === 0) {

        context.moveTo(
          x,
          y
        );

      } else {

        context.lineTo(
          x,
          y
        );

      }

    }


    context.strokeStyle =
      hoveredCity === destination
        ? "rgba(255,255,255,1)"
        : "rgba(255,255,255,.24)";


    context.lineWidth =
      hoveredCity === destination
        ? 1.8
        : 0.75;


    context.stroke();
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
       Ocean
       -------------------------------------------------------- */

    context.beginPath();

    path({
      type: "Sphere"
    });

    context.fillStyle =
      "#071b33";

    context.fill();


    /* --------------------------------------------------------
       Globe outline
       -------------------------------------------------------- */

    context.beginPath();

    path({
      type: "Sphere"
    });

    context.strokeStyle =
      "rgba(255,255,255,.28)";

    context.lineWidth =
      0.8;

    context.stroke();


    /* --------------------------------------------------------
       Land
       -------------------------------------------------------- */

    context.beginPath();

    path(
      land
    );

    context.fillStyle =
      "#0d3156";

    context.fill();


    context.strokeStyle =
      "rgba(255,255,255,.16)";

    context.lineWidth =
      0.45;

    context.stroke();


    /* --------------------------------------------------------
       Graticule
       -------------------------------------------------------- */

    context.beginPath();

    path(
      d3.geoGraticule10()
    );

    context.strokeStyle =
      "rgba(255,255,255,.07)";

    context.lineWidth =
      0.5;

    context.stroke();


    /* --------------------------------------------------------
       Alumni connections
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
       Alumni cities
       -------------------------------------------------------- */

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
       * Slightly scale dots by alumni count,
       * but cap them so Toronto-area cities
       * don't overwhelm the globe.
       */

      const radius =
        Math.min(
          6,
          1.4 +
          Math.sqrt(
            city.count
          ) *
          0.18
        );


      context.beginPath();


      context.arc(
        point[0],
        point[1],
        hoveredCity === city
          ? radius + 2
          : radius,
        0,
        Math.PI * 2
      );


      context.fillStyle =
        "#ffffff";


      context.fill();

    }


    /* --------------------------------------------------------
       Toronto origin
       -------------------------------------------------------- */

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


      context.beginPath();


      context.arc(
        toronto[0],
        toronto[1],
        5,
        0,
        Math.PI * 2
      );


      context.fillStyle =
        "#0180a5";


      context.fill();


      context.strokeStyle =
        "#ffffff";


      context.lineWidth =
        2;


      context.stroke();

    }

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


          hoveredCity =
            null;


          hideTooltip();


          draw();

        }
      )

      .on(
        "end",
        () => {

          canvas.style.cursor =
            "grab";

        }
      );


  /* ==========================================================
     HOVER
     ========================================================== */

  function pointerMoved(event) {

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
      14;


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

    tooltip.innerHTML =
      `
        <strong>${city.city}</strong>
        <span>
          ${city.country}<br>
          ${city.count.toLocaleString()}
          ${city.count === 1 ? "alumnus" : "alumni"}
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

      await loadData();


      resize();


      d3
        .select(canvas)
        .call(
          drag
        );


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
