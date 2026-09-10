/* ==========================================================
   U of T Statistics Graduate Programs
   Interactive Collision Hero

   Physics model:
   - Starts already assembled — no convergence animation
   - Broad, loose central cloud
   - Cursor behaves like a large invisible physical object
   - Strong immediate displacement
   - Ball-to-ball collision transfers movement through cluster
   - Moderate damping gives particles weight
   - Gentle centering restores the overall composition
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

  const ctx =
    canvas.getContext("2d");


  /* ==========================================================
     CONFIGURATION
     ========================================================== */

  const PARTICLE_COUNT = 150;

  const MIN_RADIUS = 5;
  const MAX_RADIUS = 16;


  /*
   * INITIAL CLOUD
   *
   * Higher = larger initial cluster.
   *
   * This is intentionally broader than the previous
   * tightly-packed ball.
   */
  const CLOUD_WIDTH = 0.52;
  const CLOUD_HEIGHT = 0.50;


  /*
   * CENTERING
   *
   * Keep this relatively gentle.
   *
   * The centre force should maintain the composition,
   * not overpower pointer interaction.
   */
  const CENTER_STRENGTH_X = 0.018;
  const CENTER_STRENGTH_Y = 0.018;


  /*
   * WEIGHT / FRICTION
   *
   * D3 velocityDecay:
   *
   * lower = more momentum / slippery
   * higher = more damping / heavy
   *
   * 0.22 gives substantially more physical movement
   * than the previous 0.38.
   */
  const VELOCITY_DECAY = 0.22;


  /*
   * CURSOR
   *
   * Think of this as the radius of an invisible ball
   * attached to the mouse.
   */
  const POINTER_RADIUS = 82;


  /*
   * Extra space between pointer and visible particles.
   */
  const POINTER_PADDING = 4;


  /*
   * How aggressively particles are pushed out of
   * pointer overlap.
   *
   * 1 = full positional correction.
   */
  const POINTER_POSITION_STRENGTH = 0.92;


  /*
   * Velocity imparted by cursor movement.
   *
   * This is what makes a fast sweep genuinely knock
   * particles sideways.
   */
  const POINTER_MOMENTUM = 0.42;


  /*
   * Additional outward velocity when the pointer
   * physically intersects a particle.
   */
  const POINTER_KICK = 0.85;


  /*
   * Limit extreme mouse velocities.
   *
   * Prevents a huge jump if the browser skips frames.
   */
  const MAX_POINTER_SPEED = 45;


  /*
   * BALL COLLISION
   */
  const COLLISION_PADDING = 2;
  const COLLISION_STRENGTH = 1;
  const COLLISION_ITERATIONS = 4;


  /*
   * Invisible settling before first frame.
   */
  const SETTLE_TICKS = 120;


  /*
   * Keep the simulation mildly alive so interaction
   * remains responsive.
   */
  const IDLE_ALPHA_TARGET = 0.025;

  const ACTIVE_ALPHA_TARGET = 0.16;


  /* ==========================================================
     STATE
     ========================================================== */

  let width = 0;
  let height = 0;
  let dpr = 1;

  let nodes = [];

  let simulation = null;


  const pointer = {

    x: 0,
    y: 0,

    previousX: 0,
    previousY: 0,

    vx: 0,
    vy: 0,

    active: false

  };


  /* ==========================================================
     HELPERS
     ========================================================== */

  function random(min, max) {

    return (
      min +
      Math.random() *
      (max - min)
    );

  }


  function clamp(
    value,
    minimum,
    maximum
  ) {

    return Math.max(
      minimum,
      Math.min(
        maximum,
        value
      )
    );

  }


  /* ==========================================================
     INITIAL DISTRIBUTION
     ========================================================== */

  function createNodes() {

    nodes = [];


    /*
     * Determine the desired cloud dimensions from
     * the actual viewport.
     */

    const cloudWidth =
      Math.min(
        width * CLOUD_WIDTH,
        720
      );


    const cloudHeight =
      Math.min(
        height * CLOUD_HEIGHT,
        480
      );


    /*
     * Golden angle gives us a predictable, visually
     * even distribution without requiring the live
     * simulation to assemble the cloud.
     */

    const goldenAngle =
      Math.PI *
      (3 - Math.sqrt(5));


    for (
      let i = 0;
      i < PARTICLE_COUNT;
      i++
    ) {

      const r =
        random(
          MIN_RADIUS,
          MAX_RADIUS
        );


      /*
       * Normalized radial position.
       */

      const progress =
        Math.sqrt(
          (i + 0.5) /
          PARTICLE_COUNT
        );


      const angle =
        i *
        goldenAngle;


      /*
       * Elliptical cloud.
       *
       * Small random variation removes the obvious
       * mathematical spiral appearance.
       */

      const jitter =
        random(
          0.90,
          1.08
        );


      const x =
        Math.cos(angle) *
        progress *
        cloudWidth *
        0.5 *
        jitter;


      const y =
        Math.sin(angle) *
        progress *
        cloudHeight *
        0.5 *
        jitter;


      nodes.push({

        r,

        x,
        y,

        vx: 0,
        vy: 0

      });

    }

  }


  /* ==========================================================
     SIMULATION
     ========================================================== */

  function createSimulation() {

    if (simulation) {
      simulation.stop();
    }


    simulation =
      d3.forceSimulation(nodes)


        /* ----------------------------------------------------
           MASS / DAMPING
           ---------------------------------------------------- */

        .velocityDecay(
          VELOCITY_DECAY
        )


        /* ----------------------------------------------------
           GENTLE HORIZONTAL CENTERING
           ---------------------------------------------------- */

        .force(
          "x",

          d3
            .forceX(0)
            .strength(
              CENTER_STRENGTH_X
            )
        )


        /* ----------------------------------------------------
           GENTLE VERTICAL CENTERING
           ---------------------------------------------------- */

        .force(
          "y",

          d3
            .forceY(0)
            .strength(
              CENTER_STRENGTH_Y
            )
        )


        /* ----------------------------------------------------
           BALL-TO-BALL COLLISION
           ---------------------------------------------------- */

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


        .stop();


    /* ========================================================
       SETTLE OFF-SCREEN
       ======================================================== */

    simulation.alpha(0.45);


    for (
      let i = 0;
      i < SETTLE_TICKS;
      i++
    ) {

      simulation.tick();

    }


    /*
     * Remove residual motion.
     */

    for (const node of nodes) {

      node.vx = 0;
      node.vy = 0;

    }


    /*
     * Draw the already-complete opening state.
     */

    draw();


    /* ========================================================
       START LIVE SIMULATION
       ======================================================== */

    simulation

      .alpha(0.08)

      .alphaTarget(
        IDLE_ALPHA_TARGET
      )

      .on(
        "tick",
        ticked
      )

      .restart();

  }


  /* ==========================================================
     POINTER COLLISION

     This is the important part.

     Instead of applying a distant magnetic repulsion,
     the cursor acts as an actual circular body.

     If a particle overlaps that circle, we immediately
     resolve the overlap.
     ========================================================== */

  function collideWithPointer() {

    if (!pointer.active) {
      return;
    }


    for (const node of nodes) {


      const dx =
        node.x -
        pointer.x;


      const dy =
        node.y -
        pointer.y;


      let distanceSquared =
        dx * dx +
        dy * dy;


      const minimumDistance =
        POINTER_RADIUS +
        node.r +
        POINTER_PADDING;


      if (
        distanceSquared <
        minimumDistance *
        minimumDistance
      ) {


        let distance =
          Math.sqrt(
            distanceSquared
          );


        let nx;
        let ny;


        /* ----------------------------------------------------
           EXACT CENTRE CASE
           ---------------------------------------------------- */

        if (distance < 0.001) {

          const angle =
            Math.random() *
            Math.PI *
            2;


          nx =
            Math.cos(angle);


          ny =
            Math.sin(angle);


          distance =
            0.001;

        } else {

          nx =
            dx /
            distance;


          ny =
            dy /
            distance;

        }


        /* ----------------------------------------------------
           OVERLAP
           ---------------------------------------------------- */

        const overlap =
          minimumDistance -
          distance;


        /* ----------------------------------------------------
           IMMEDIATE POSITIONAL CORRECTION

           This prevents the pointer from slowly "asking"
           particles to move.

           The particle simply cannot occupy the same
           physical space as the cursor.
           ---------------------------------------------------- */

        const correction =
          overlap *
          POINTER_POSITION_STRENGTH;


        node.x +=
          nx *
          correction;


        node.y +=
          ny *
          correction;


        /* ----------------------------------------------------
           OUTWARD KICK

           The deeper the overlap, the harder the hit.
           ---------------------------------------------------- */

        const penetration =
          overlap /
          minimumDistance;


        node.vx +=
          nx *
          penetration *
          POINTER_KICK *
          8;


        node.vy +=
          ny *
          penetration *
          POINTER_KICK *
          8;


        /* ----------------------------------------------------
           TRANSFER CURSOR MOMENTUM

           This gives horizontal/vertical mouse sweeps
           directional influence rather than merely pushing
           particles radially away.
           ---------------------------------------------------- */

        node.vx +=
          pointer.vx *
          POINTER_MOMENTUM;


        node.vy +=
          pointer.vy *
          POINTER_MOMENTUM;

      }

    }

  }


  /* ==========================================================
     KEEP PARTICLES WITHIN HERO
     ========================================================== */

  function constrainToViewport() {

    /*
     * Coordinates are centred around 0,0.
     */

    const halfWidth =
      width / 2;


    const halfHeight =
      height / 2;


    for (const node of nodes) {


      /* LEFT */

      if (
        node.x - node.r <
        -halfWidth
      ) {

        node.x =
          -halfWidth +
          node.r;


        node.vx =
          Math.abs(
            node.vx
          ) *
          0.45;

      }


      /* RIGHT */

      if (
        node.x + node.r >
        halfWidth
      ) {

        node.x =
          halfWidth -
          node.r;


        node.vx =
          -Math.abs(
            node.vx
          ) *
          0.45;

      }


      /* TOP */

      if (
        node.y - node.r <
        -halfHeight
      ) {

        node.y =
          -halfHeight +
          node.r;


        node.vy =
          Math.abs(
            node.vy
          ) *
          0.45;

      }


      /* BOTTOM */

      if (
        node.y + node.r >
        halfHeight
      ) {

        node.y =
          halfHeight -
          node.r;


        node.vy =
          -Math.abs(
            node.vy
          ) *
          0.45;

      }

    }

  }


  /* ==========================================================
     TICK
     ========================================================== */

  function ticked() {

    /*
     * Resolve pointer overlap every physics frame.
     */

    collideWithPointer();


    constrainToViewport();


    /*
     * Cursor velocity should rapidly decay when the
     * mouse stops moving.
     *
     * Otherwise a stationary pointer would continue
     * transferring its previous movement.
     */

    pointer.vx *= 0.48;
    pointer.vy *= 0.48;


    draw();

  }


  /* ==========================================================
     DRAW
     ========================================================== */

  function draw() {

    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    ctx.save();


    /*
     * Our simulation uses 0,0 as the visual centre.
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
     GET POINTER POSITION
     ========================================================== */

  function getPointerPosition(event) {

    const rect =
      canvas.getBoundingClientRect();


    return {

      x:
        event.clientX -
        rect.left -
        width / 2,

      y:
        event.clientY -
        rect.top -
        height / 2

    };

  }


  /* ==========================================================
     POINTER ENTER
     ========================================================== */

  function pointerEntered(event) {

    const position =
      getPointerPosition(
        event
      );


    pointer.x =
      position.x;


    pointer.y =
      position.y;


    pointer.previousX =
      position.x;


    pointer.previousY =
      position.y;


    pointer.vx = 0;
    pointer.vy = 0;


    pointer.active = true;


    simulation

      .alphaTarget(
        ACTIVE_ALPHA_TARGET
      )

      .alpha(0.35)

      .restart();


    /*
     * Resolve immediately rather than waiting
     * for the next scheduled tick.
     */

    collideWithPointer();

    draw();

  }


  /* ==========================================================
     POINTER MOVE
     ========================================================== */

  function pointerMoved(event) {

    const position =
      getPointerPosition(
        event
      );


    /* --------------------------------------------------------
       CURSOR VELOCITY
       -------------------------------------------------------- */

    let vx =
      position.x -
      pointer.x;


    let vy =
      position.y -
      pointer.y;


    /*
     * Clamp unusual frame jumps.
     */

    const speed =
      Math.sqrt(
        vx * vx +
        vy * vy
      );


    if (
      speed >
      MAX_POINTER_SPEED
    ) {

      const scale =
        MAX_POINTER_SPEED /
        speed;


      vx *= scale;
      vy *= scale;

    }


    pointer.previousX =
      pointer.x;


    pointer.previousY =
      pointer.y;


    pointer.x =
      position.x;


    pointer.y =
      position.y;


    pointer.vx =
      vx;


    pointer.vy =
      vy;


    pointer.active =
      true;


    /* --------------------------------------------------------
       IMMEDIATE COLLISION

       Do not wait for D3's next animation frame.
       -------------------------------------------------------- */

    collideWithPointer();


    /* --------------------------------------------------------
       WAKE SIMULATION
       -------------------------------------------------------- */

    simulation

      .alphaTarget(
        ACTIVE_ALPHA_TARGET
      )

      .alpha(
        Math.max(
          simulation.alpha(),
          0.28
        )
      )

      .restart();


    draw();

  }


  /* ==========================================================
     POINTER LEAVE
     ========================================================== */

  function pointerLeft() {

    pointer.active =
      false;


    pointer.vx = 0;
    pointer.vy = 0;


    /*
     * Return to gentle idle physics.
     */

    simulation

      .alphaTarget(
        IDLE_ALPHA_TARGET
      )

      .alpha(
        Math.max(
          simulation.alpha(),
          0.16
        )
      )

      .restart();

  }


  /* ==========================================================
     RESIZE
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


    dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );


    canvas.width =
      Math.round(
        width *
        dpr
      );


    canvas.height =
      Math.round(
        height *
        dpr
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

  function init() {

    resizeCanvas();


    /*
     * Generate the broad starting cloud.
     */

    createNodes();


    /*
     * Settle it invisibly and start physics.
     */

    createSimulation();


    if (
      prefersReducedMotion()
    ) {

      simulation.stop();

      draw();

      return;

    }


    /* --------------------------------------------------------
       POINTER EVENTS
       -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       RESIZE
       -------------------------------------------------------- */

    window.addEventListener(
      "resize",
      resizeCanvas,
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
