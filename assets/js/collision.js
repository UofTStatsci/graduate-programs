/* ==========================================================
   U of T Statistics Graduate Programs
   Interactive Collision Hero
   ========================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("collision-canvas");

  if (!canvas) {
    console.warn("Collision canvas not found.");
    return;
  }

  const context = canvas.getContext("2d");

  /* ----------------------------------------------------------
     SETTINGS
     ---------------------------------------------------------- */

  const PARTICLE_COUNT = 200;

  // Particle size range
  const MIN_RADIUS = 4;
  const MAX_RADIUS = 16;

  // How tightly particles are packed when first created
  const INITIAL_CLUSTER_RADIUS = 30;

  // Strength of attraction back toward the centre
  // Higher = faster return
  const CENTER_FORCE = 0.08;

  // Lower values retain more velocity / feel more energetic
  const VELOCITY_DECAY = 0.08;

  // Pointer repulsion strength
  // Higher = stronger and faster reaction
  const POINTER_FORCE_MULTIPLIER = 1.5;

  // Collision settings
  const COLLISION_PADDING = 1;
  const COLLISION_STRENGTH = 1;
  const COLLISION_ITERATIONS = 4;


  /* ----------------------------------------------------------
     STATE
     ---------------------------------------------------------- */

  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  let nodes = [];
  let simulation = null;


  /* ----------------------------------------------------------
     RANDOM HELPERS
     ---------------------------------------------------------- */

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }


  /* ----------------------------------------------------------
     CREATE PARTICLES
     ---------------------------------------------------------- */

  function createNodes() {
    nodes = Array.from(
      { length: PARTICLE_COUNT + 1 },
      (_, i) => {

        /*
         * Node 0 is invisible.
         *
         * It follows the cursor and acts as the repulsive
         * force used to push the visible particles away.
         */
        if (i === 0) {
          return {
            r: 0,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0
          };
        }

        /*
         * Start every visible particle close to the centre.
         *
         * We deliberately DON'T place every particle at
         * exactly 0,0 because the collision solver would
         * initially have 200 overlapping particles to resolve.
         */

        const angle = Math.random() * Math.PI * 2;

        const distance =
          Math.sqrt(Math.random()) *
          INITIAL_CLUSTER_RADIUS;

        return {
          r: randomBetween(
            MIN_RADIUS,
            MAX_RADIUS
          ),

          x:
            Math.cos(angle) *
            distance,

          y:
            Math.sin(angle) *
            distance,

          vx: 0,
          vy: 0
        };
      }
    );
  }


  /* ----------------------------------------------------------
     CREATE D3 FORCE SIMULATION
     ---------------------------------------------------------- */

  function createSimulation() {

    if (simulation) {
      simulation.stop();
    }

    simulation = d3
      .forceSimulation(nodes)

      /*
       * Keep the simulation alive.
       *
       * We want this visualization to remain interactive
       * indefinitely rather than eventually "cooling down."
       */

      .alpha(1)
      .alphaTarget(0.3)
      .alphaDecay(0)

      /*
       * Low friction.
       *
       * Lower velocityDecay produces quicker,
       * more responsive movement.
       */

      .velocityDecay(
        VELOCITY_DECAY
      )

      /*
       * Horizontal attraction toward centre.
       */

      .force(
        "x",
        d3
          .forceX(0)
          .strength(
            CENTER_FORCE
          )
      )

      /*
       * Vertical attraction toward centre.
       */

      .force(
        "y",
        d3
          .forceY(0)
          .strength(
            CENTER_FORCE
          )
      )

      /*
       * Collision detection.
       *
       * This prevents visible particles from
       * occupying the same space.
       */

      .force(
        "collide",
        d3
          .forceCollide()
          .radius(
            d =>
              d.r +
              COLLISION_PADDING
          )
          .strength(
            COLLISION_STRENGTH
          )
          .iterations(
            COLLISION_ITERATIONS
          )
      )

      /*
       * Pointer repulsion.
       *
       * Only node 0 generates charge.
       * The visible particles themselves do not.
       */

      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(
            (d, i) =>
              i === 0
                ? -width *
                  POINTER_FORCE_MULTIPLIER
                : 0
          )
      )

      .on(
        "tick",
        draw
      );
  }


  /* ----------------------------------------------------------
     DRAW
     ---------------------------------------------------------- */

  function draw() {

    context.clearRect(
      0,
      0,
      width,
      height
    );

    context.save();

    /*
     * D3 coordinates are centred around 0,0.
     *
     * Translate the canvas so that 0,0 visually corresponds
     * to the middle of the viewport.
     */

    context.translate(
      width / 2,
      height / 2
    );

    context.fillStyle =
      "#ffffff";

    /*
     * Skip node 0 because it is our invisible
     * pointer-repulsion node.
     */

    for (
      let i = 1;
      i < nodes.length;
      i++
    ) {

      const d = nodes[i];

      context.beginPath();

      context.arc(
        d.x,
        d.y,
        d.r,
        0,
        Math.PI * 2
      );

      context.fill();
    }

    context.restore();
  }


  /* ----------------------------------------------------------
     POINTER MOVEMENT
     ---------------------------------------------------------- */

  function pointerMoved(event) {

    const rect =
      canvas.getBoundingClientRect();

    /*
     * Convert browser coordinates into our
     * centre-origin coordinate system.
     */

    const x =
      event.clientX -
      rect.left -
      width / 2;

    const y =
      event.clientY -
      rect.top -
      height / 2;

    /*
     * Move invisible repulsion node directly
     * underneath the pointer.
     */

    nodes[0].fx = x;
    nodes[0].fy = y;

    /*
     * Immediately energize the simulation.
     *
     * This is what removes much of the sluggish
     * cursor response from the previous version.
     */

    simulation
      .alpha(1)
      .restart();
  }


  /* ----------------------------------------------------------
     POINTER LEAVES HERO
     ---------------------------------------------------------- */

  function pointerLeft() {

    /*
     * Release the invisible node.
     */

    nodes[0].fx = null;
    nodes[0].fy = null;

    /*
     * Put it back at the centre.
     */

    nodes[0].x = 0;
    nodes[0].y = 0;

    nodes[0].vx = 0;
    nodes[0].vy = 0;

    /*
     * Re-energize the simulation so particles
     * return immediately rather than lazily drifting.
     */

    simulation
      .alpha(1)
      .restart();
  }


  /* ----------------------------------------------------------
     TOUCH SUPPORT
     ---------------------------------------------------------- */

  function touchMoved(event) {

    if (
      !event.touches ||
      !event.touches.length
    ) {
      return;
    }

    event.preventDefault();

    const touch =
      event.touches[0];

    const rect =
      canvas.getBoundingClientRect();

    const x =
      touch.clientX -
      rect.left -
      width / 2;

    const y =
      touch.clientY -
      rect.top -
      height / 2;

    nodes[0].fx = x;
    nodes[0].fy = y;

    simulation
      .alpha(1)
      .restart();
  }


  function touchEnded() {
    pointerLeft();
  }


  /* ----------------------------------------------------------
     RESPONSIVE CANVAS
     ---------------------------------------------------------- */

  function resizeCanvas() {

    const rect =
      canvas.getBoundingClientRect();

    width =
      rect.width ||
      window.innerWidth;

    height =
      rect.height ||
      window.innerHeight;

    /*
     * Limit pixel ratio to avoid unnecessarily expensive
     * canvas rendering on very high-DPI displays.
     */

    pixelRatio =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    canvas.width =
      Math.round(
        width * pixelRatio
      );

    canvas.height =
      Math.round(
        height * pixelRatio
      );

    canvas.style.width =
      `${width}px`;

    canvas.style.height =
      `${height}px`;

    /*
     * Allow drawing code to continue using
     * normal CSS pixel coordinates.
     */

    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0
    );

    /*
     * Update pointer force because it scales
     * relative to viewport width.
     */

    if (simulation) {

      simulation.force(
        "charge",
        d3
          .forceManyBody()
          .strength(
            (d, i) =>
              i === 0
                ? -width *
                  POINTER_FORCE_MULTIPLIER
                : 0
          )
      );

      simulation
        .alpha(1)
        .restart();
    }
  }


  /* ----------------------------------------------------------
     INITIAL SETUP
     ---------------------------------------------------------- */

  function init() {

    resizeCanvas();

    createNodes();

    createSimulation();

    /*
     * Pointer interaction
     */

    canvas.addEventListener(
      "pointermove",
      pointerMoved,
      {
        passive: true
      }
    );

    canvas.addEventListener(
      "pointerleave",
      pointerLeft
    );

    /*
     * Touch interaction
     */

    canvas.addEventListener(
      "touchmove",
      touchMoved,
      {
        passive: false
      }
    );

    canvas.addEventListener(
      "touchend",
      touchEnded
    );

    /*
     * Responsive resizing
     */

    window.addEventListener(
      "resize",
      resizeCanvas
    );
  }


  /* ----------------------------------------------------------
     START
     ---------------------------------------------------------- */

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
