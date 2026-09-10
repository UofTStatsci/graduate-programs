/* ==========================================================
   U of T Statistics Graduate Programs
   Collision Hero

   Direct adaptation of:
   Observable / D3 Collision Detection
   https://observablehq.com/@d3/collision-detection/2

   Responsive node counts:
   - Desktop: 400
   - Tablet:  200
   - Mobile:  100

   Changes from Observable:
   - Full-screen responsive canvas
   - All visible nodes are white
   - Responsive number of nodes
   ========================================================== */

(() => {
  "use strict";


  /* ==========================================================
     CANVAS
     ========================================================== */

  const canvas =
    document.getElementById("collision-canvas");

  if (!canvas) {
    console.warn("Collision canvas not found.");
    return;
  }

  if (typeof d3 === "undefined") {
    console.warn("D3 is not loaded.");
    return;
  }

  const context =
    canvas.getContext("2d");


  /* ==========================================================
     STATE
     ========================================================== */

  let width = 0;
  let height = 0;
  let dpr = 1;

  let nodes = [];
  let simulation = null;


  /* ==========================================================
     RESPONSIVE PARTICLE COUNT

     Mobile:
     100 particles

     Tablet:
     200 particles

     Desktop:
     400 particles
     ========================================================== */

  function getParticleCount() {

    if (width <= 600) {
      return 100;
    }

    if (width <= 1024) {
      return 200;
    }

    return 400;
  }


  /* ==========================================================
     CREATE DATA
     ========================================================== */

  function createData() {

    /*
     * Observable uses:
     *
     * const k = width / 200;
     *
     * Our canvas is rectangular rather than square,
     * so use the smaller dimension to prevent particles
     * becoming excessively large on wide desktop screens.
     */

    const referenceSize =
      Math.min(
        width,
        height
      );


    const k =
      referenceSize / 200;


    /*
     * Same radius distribution as the Observable example:
     *
     * k → k * 4
     */

    const radius =
      d3.randomUniform(
        k,
        k * 4
      );


    const groups = 4;


    /*
     * Determine responsive particle count.
     */

    const particleCount =
      getParticleCount();


    return Array.from(
      {
        length: particleCount
      },

      (_, i) => ({

        r:
          radius(),

        group:
          i &&
          (i % groups + 1)

      })
    );
  }


  /* ==========================================================
     CANVAS SIZE
     ========================================================== */

  function resizeCanvas() {

    const rect =
      canvas.getBoundingClientRect();


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


    /*
     * Cap device pixel ratio at 2.
     *
     * This keeps the canvas sharp without unnecessarily
     * increasing rendering cost on very high-DPI displays.
     */

    dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );


    /* --------------------------------------------------------
       Physical canvas resolution
       -------------------------------------------------------- */

    canvas.width =
      Math.round(
        width * dpr
      );


    canvas.height =
      Math.round(
        height * dpr
      );


    /* --------------------------------------------------------
       CSS dimensions
       -------------------------------------------------------- */

    canvas.style.width =
      `${width}px`;


    canvas.style.height =
      `${height}px`;


    /* --------------------------------------------------------
       High-DPI scaling
       -------------------------------------------------------- */

    context.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }


  /* ==========================================================
     DRAW / SIMULATION TICK
     ========================================================== */

  function ticked() {

    /*
     * Clear previous frame.
     */

    context.clearRect(
      0,
      0,
      width,
      height
    );


    context.save();


    /*
     * Match Observable's coordinate system.
     *
     * D3's simulation is centred around 0,0.
     */

    context.translate(
      width / 2,
      height / 2
    );


    /*
     * IMPORTANT:
     *
     * Begin at node 1.
     *
     * Node 0 is invisible because it acts as the
     * charged node attached to the cursor.
     */

    for (
      let i = 1;
      i < nodes.length;
      ++i
    ) {

      const d =
        nodes[i];


      context.beginPath();


      context.moveTo(
        d.x + d.r,
        d.y
      );


      context.arc(
        d.x,
        d.y,
        d.r,
        0,
        2 * Math.PI
      );


      /*
       * Observable uses Tableau colours.
       *
       * U of T version:
       * all visible particles are white.
       */

      context.fillStyle =
        "#ffffff";


      context.fill();
    }


    context.restore();
  }


  /* ==========================================================
     POINTER MOVEMENT

     This deliberately matches the Observable example.

     Node 0 follows the cursor.

     Its strong negative charge pushes the visible nodes
     away through D3's forceManyBody().
     ========================================================== */

  function pointermoved(event) {

    const [x, y] =
      d3.pointer(
        event,
        canvas
      );


    nodes[0].fx =
      x -
      width / 2;


    nodes[0].fy =
      y -
      height / 2;
  }


  /* ==========================================================
     CREATE SIMULATION
     ========================================================== */

  function createSimulation() {

    /*
     * Stop an existing simulation before rebuilding.
     */

    if (simulation) {
      simulation.stop();
    }


    /*
     * Generate fresh responsive data.
     */

    nodes =
      createData()
        .map(Object.create);


    /* ========================================================
       OBSERVABLE PHYSICS

       These values are intentionally preserved from:

       https://observablehq.com/@d3/collision-detection/2
       ======================================================== */

    simulation =
      d3.forceSimulation(
        nodes
      )


        /* ----------------------------------------------------
           Keep simulation hot
           ---------------------------------------------------- */

        .alphaTarget(
          0.3
        )


        /* ----------------------------------------------------
           Low friction
           ---------------------------------------------------- */

        .velocityDecay(
          0.1
        )


        /* ----------------------------------------------------
           Horizontal centering
           ---------------------------------------------------- */

        .force(
          "x",

          d3
            .forceX()
            .strength(
              0.01
            )
        )


        /* ----------------------------------------------------
           Vertical centering
           ---------------------------------------------------- */

        .force(
          "y",

          d3
            .forceY()
            .strength(
              0.01
            )
        )


        /* ----------------------------------------------------
           Collision detection
           ---------------------------------------------------- */

        .force(
          "collide",

          d3
            .forceCollide()

            .radius(
              d =>
                d.r + 1
            )

            .iterations(
              3
            )
        )


        /* ----------------------------------------------------
           Pointer repulsion

           Node 0 receives a strong negative charge.

           Every other node has zero charge.

           This is exactly how the Observable example
           creates its cursor interaction.
           ---------------------------------------------------- */

        .force(
          "charge",

          d3
            .forceManyBody()

            .strength(
              (d, i) =>
                i
                  ? 0
                  : -width * 2 / 3
            )
        )


        /* ----------------------------------------------------
           Render
           ---------------------------------------------------- */

        .on(
          "tick",
          ticked
        );
  }


  /* ==========================================================
     RESIZE

     Rebuild the simulation when crossing viewport sizes.

     This also recalculates:
     - particle count
     - particle radius
     - pointer charge
     ========================================================== */

  function resized() {

    resizeCanvas();

    createSimulation();
  }


  /* ==========================================================
     INITIALIZE
     ========================================================== */

  function init() {

    /*
     * Size canvas first.
     */

    resizeCanvas();


    /*
     * Create simulation.
     */

    createSimulation();


    /* --------------------------------------------------------
       Pointer interaction
       -------------------------------------------------------- */

    d3
      .select(canvas)

      .on(
        "touchmove",

        event =>
          event.preventDefault()
      )

      .on(
        "pointermove",
        pointermoved
      );


    /* --------------------------------------------------------
       Responsive resize
       -------------------------------------------------------- */

    window.addEventListener(
      "resize",
      resized,
      {
        passive: true
      }
    );
  }


  /* ==========================================================
     START
     ========================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();
  }

})();
