/* ==========================================================
   U of T Statistics Graduate Programs
   Heavy Collision Hero
   ========================================================== */

(() => {
  "use strict";

  const canvas = document.getElementById("collision-canvas");

  if (!canvas || typeof d3 === "undefined") {
    console.warn("Collision canvas or D3 not found.");
    return;
  }

  const ctx = canvas.getContext("2d");

  /* ==========================================================
     CONFIGURATION
     ========================================================== */

  const PARTICLE_COUNT = 200;

  const MIN_RADIUS = 5;
  const MAX_RADIUS = 16;

  /*
   * Radius of the assembled cluster.
   *
   * This is NOT the starting scatter radius.
   * We pre-pack the particles before displaying them.
   */
  const CLUSTER_RADIUS = 150;

  /*
   * Restoring force.
   *
   * Relatively strong, but combined with heavy damping.
   */
  const CENTER_STRENGTH = 0.075;

  /*
   * HIGH velocity decay = heavy / damped.
   *
   * D3 velocityDecay works somewhat like friction.
   */
  const VELOCITY_DECAY = 0.32;

  /*
   * Mouse interaction radius.
   */
  const POINTER_RADIUS = 150;

  /*
   * Direct impulse applied by mouse.
   *
   * This is intentionally strong.
   */
  const POINTER_FORCE = 8.5;

  /*
   * Additional force when pointer itself is moving quickly.
   */
  const POINTER_VELOCITY_FORCE = 0.10;

  /*
   * Collision configuration.
   */
  const COLLISION_PADDING = 1.5;
  const COLLISION_ITERATIONS = 6;

  /*
   * Number of invisible simulation ticks used to build
   * the cluster BEFORE we show it.
   */
  const PRE_TICKS = 300;


  /* ==========================================================
     STATE
     ========================================================== */

  let width;
  let height;
  let dpr;

  let nodes = [];
  let simulation;

  let pointerX = null;
  let pointerY = null;

  let previousPointerX = null;
  let previousPointerY = null;

  let pointerVX = 0;
  let pointerVY = 0;


  /* ==========================================================
     HELPERS
     ========================================================== */

  function random(min, max) {
    return min + Math.random() * (max - min);
  }


  /* ==========================================================
     CREATE PARTICLES
     ========================================================== */

  function createNodes() {

    nodes = Array.from(
      { length: PARTICLE_COUNT },
      () => {

        /*
         * Initially place particles in a SMALL area.
         *
         * This state is never drawn.
         *
         * The simulation will pack them before the first
         * visible frame.
         */

        const angle =
          Math.random() *
          Math.PI *
          2;

        const distance =
          Math.sqrt(Math.random()) *
          CLUSTER_RADIUS *
          0.35;

        return {

          r: random(
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


  /* ==========================================================
     SIMULATION
     ========================================================== */

  function createSimulation() {

    simulation = d3
      .forceSimulation(nodes)

      /*
       * Heavy movement.
       */
      .velocityDecay(
        VELOCITY_DECAY
      )

      /*
       * Pull everything toward the centre.
       */
      .force(
        "x",
        d3
          .forceX(0)
          .strength(
            CENTER_STRENGTH
          )
      )

      .force(
        "y",
        d3
          .forceY(0)
          .strength(
            CENTER_STRENGTH
          )
      )

      /*
       * Hard collision.
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
          .strength(1)
          .iterations(
            COLLISION_ITERATIONS
          )
      )

      /*
       * Don't automatically draw yet.
       */
      .stop();


    /* ========================================================
       PRE-CALCULATE THE CLUSTER

       THIS IS THE IMPORTANT CHANGE.

       We run hundreds of simulation ticks before the user
       sees the canvas.

       Therefore the opening frame is ALREADY assembled.
       ======================================================== */

    simulation.alpha(1);

    for (
      let i = 0;
      i < PRE_TICKS;
      i++
    ) {

      simulation.tick();
    }


    /*
     * Kill residual velocities created during packing.
     *
     * Otherwise the cluster can appear to "breathe"
     * when it first becomes visible.
     */

    for (const node of nodes) {

      node.vx = 0;
      node.vy = 0;
    }


    /*
     * NOW start the visible simulation.
     */

    simulation
      .alpha(0.15)
      .alphaTarget(0)
      .on("tick", draw)
      .restart();

    /*
     * Draw immediately rather than waiting for first tick.
     */

    draw();
  }


  /* ==========================================================
     POINTER PHYSICS

     Instead of treating the cursor as a weak electrical
     charge, we directly push balls inside its influence
     radius.

     This gives the interaction much more physical weight.
     ========================================================== */

  function applyPointerForce() {

    if (
      pointerX === null ||
      pointerY === null
    ) {
      return;
    }


    for (const node of nodes) {

      const dx =
        node.x -
        pointerX;

      const dy =
        node.y -
        pointerY;

      const distanceSquared =
        dx * dx +
        dy * dy;

      const interactionRadius =
        POINTER_RADIUS +
        node.r;

      if (
        distanceSquared <
        interactionRadius *
        interactionRadius
      ) {

        let distance =
          Math.sqrt(
            distanceSquared
          );


        /*
         * Protect against division by zero.
         */

        if (distance < 0.1) {
          distance = 0.1;
        }


        /*
         * Normalized direction AWAY from cursor.
         */

        const nx =
          dx / distance;

        const ny =
          dy / distance;


        /*
         * Strongest close to pointer.
         *
         * Drops toward zero at edge of interaction radius.
         */

        const proximity =
          1 -
          distance /
          interactionRadius;


        /*
         * Squared proximity makes the force feel much more
         * solid near the cursor rather than like a broad,
         * weak magnetic field.
         */

        const impact =
          proximity *
          proximity *
          POINTER_FORCE;


        /*
         * Direct velocity impulse.
         */

        node.vx +=
          nx *
          impact;

        node.vy +=
          ny *
          impact;


        /*
         * Transfer some of the cursor's movement into
         * the particles.

         * This makes sweeping through the cluster feel
         * like physically striking the balls.
         */

        node.vx +=
          pointerVX *
          proximity *
          POINTER_VELOCITY_FORCE;

        node.vy +=
          pointerVY *
          proximity *
          POINTER_VELOCITY_FORCE;
      }
    }
  }


  /* ==========================================================
     DRAW
     ========================================================== */

  function draw() {

    /*
     * Apply interaction BEFORE rendering.
     */

    applyPointerForce();


    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    ctx.save();


    /*
     * D3 coordinates use the centre of the canvas
     * as our origin.
     */

    ctx.translate(
      width / 2,
      height / 2
    );


    ctx.fillStyle =
      "#ffffff";


    for (const node of nodes) {

      ctx.beginPath();

      ctx.arc(
        node.x,
        node.y,
        node.r,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }


    ctx.restore();
  }


  /* ==========================================================
     POINTER MOVEMENT
     ========================================================== */

  function pointerMoved(event) {

    const rect =
      canvas.getBoundingClientRect();


    const newX =
      event.clientX -
      rect.left -
      width / 2;

    const newY =
      event.clientY -
      rect.top -
      height / 2;


    /*
     * Calculate cursor velocity.
     */

    if (
      previousPointerX !== null &&
      previousPointerY !== null
    ) {

      pointerVX =
        newX -
        previousPointerX;

      pointerVY =
        newY -
        previousPointerY;

    } else {

      pointerVX = 0;
      pointerVY = 0;
    }


    previousPointerX =
      newX;

    previousPointerY =
      newY;

    pointerX =
      newX;

    pointerY =
      newY;


    /*
     * Wake simulation immediately.
     */

    simulation
      .alpha(0.7)
      .restart();
  }


  /* ==========================================================
     POINTER LEAVE
     ========================================================== */

  function pointerLeft() {

    pointerX = null;
    pointerY = null;

    previousPointerX = null;
    previousPointerY = null;

    pointerVX = 0;
    pointerVY = 0;


    /*
     * Let centre forces pull everything back together.
     */

    simulation
      .alpha(0.45)
      .restart();
  }


  /* ==========================================================
     POINTER ENTER
     ========================================================== */

  function pointerEntered(event) {

    const rect =
      canvas.getBoundingClientRect();

    pointerX =
      event.clientX -
      rect.left -
      width / 2;

    pointerY =
      event.clientY -
      rect.top -
      height / 2;

    previousPointerX =
      pointerX;

    previousPointerY =
      pointerY;
  }


  /* ==========================================================
     CANVAS SIZE
     ========================================================== */

  function resizeCanvas() {

    const rect =
      canvas.getBoundingClientRect();

    width =
      rect.width ||
      window.innerWidth;

    height =
      rect.height ||
      window.innerHeight;


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


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    draw();
  }


  /* ==========================================================
     INITIALIZE
     ========================================================== */

  function init() {

    resizeCanvas();

    createNodes();

    createSimulation();


    canvas.addEventListener(
      "pointerenter",
      pointerEntered
    );


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


    window.addEventListener(
      "resize",
      resizeCanvas
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
