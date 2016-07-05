/*
Copyleft (c) 2016 Alexey Korepanov. Forked from 
https://github.com/ErmiyaEskandary/Slither.io-bot

Original copyright notice:
Copyright (c) 2016 Ermiya Eskandary & Théophile Cailliau and other contributors
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// ==UserScript==
// @name         Slither.io-bot
// @namespace    http://slither.io/
// @version      1.2.9c
// @description  Slither.io bot
// @author       Ermiya Eskandary & Théophile Cailliau
// @match        http://slither.io/
// @grant        none
// ==/UserScript==

/*
Override bot options here
Uncomment variables you wish to change from their default values
Changes you make here will be kept between script versions
*/
var customBotOptions = {
    // target fps
    // targetFps: 30,
    // size of arc for collisionAngles
    // arcSize: Math.PI / 8,
    // radius multiple for circle intersects
    // radiusMult: 10,
    // food cluster size to trigger acceleration
    // foodAccelSize: 60,
    // maximum angle of food to trigger acceleration
    // foodAccelAngle:  Math.PI / 3,
    // how many frames per food check
    // foodFrames: 4,
    // round food cluster size up to the nearest
    // foodRoundSize: 5,
    // round food angle up to nearest for angle difference scoring
    // foodRoundAngle: Math.PI / 8,
    // food clusters at or below this size won't be considered
    // if there is a collisionAngle
    // foodSmallSize: 10,
    // angle or higher where enemy heady is considered in the rear
    // rearHeadAngle: 3 * Math.PI / 4,
    // attack emeny rear head at this angle
    // rearHeadDir: Math.PI / 2,
    // quick radius toggle size in approach mode
    // radiusApproachSize: 5,
    // quick radius toggle size in avoid mode
    // radiusAvoidSize: 25,
    // uncomment to quickly revert to the default options
    // if you update the script while this is active,
    // you will lose your custom options
    // useDefaults: true
};

// Custom logging function - disabled by default
window.log = function() {
    if (window.logDebugging) {
        console.log.apply(console, arguments);
    }
};

var canvasUtil = window.canvasUtil = (function() {
    return {
        // Ratio of screen size divided by canvas size.
        canvasRatio: {
            x: window.mc.width / window.ww,
            y: window.mc.height / window.hh
        },

        // Set direction of snake towards the virtual mouse coordinates
        setMouseCoordinates: function(point) {
            window.xm = point.x;
            window.ym = point.y;
        },

        // Convert snake-relative coordinates to absolute screen coordinates.
        mouseToScreen: function(point) {
            var screenX = point.x + (window.ww / 2);
            var screenY = point.y + (window.hh / 2);
            return {
                x: screenX,
                y: screenY
            };
        },

        // Convert screen coordinates to canvas coordinates.
        screenToCanvas: function(point) {
            var canvasX = window.csc *
                (point.x * canvasUtil.canvasRatio.x) - parseInt(window.mc.style.left);
            var canvasY = window.csc *
                (point.y * canvasUtil.canvasRatio.y) - parseInt(window.mc.style.top);
            return {
                x: canvasX,
                y: canvasY
            };
        },

        // Convert map coordinates to mouse coordinates.
        mapToMouse: function(point) {
            var mouseX = (point.x - window.snake.xx) * window.gsc;
            var mouseY = (point.y - window.snake.yy) * window.gsc;
            return {
                x: mouseX,
                y: mouseY
            };
        },

        // Map coordinates to Canvas coordinates.
        mapToCanvas: function(point) {
            var c = canvasUtil.mapToMouse(point);
            c = canvasUtil.mouseToScreen(c);
            c = canvasUtil.screenToCanvas(c);
            return c;
        },

        // Map to Canvas coordinates conversion for drawing circles.
        circleMapToCanvas: function(circle) {
            var newCircle = canvasUtil.mapToCanvas(circle);
            return canvasUtil.circle(
                newCircle.x,
                newCircle.y,
                // Radius also needs to scale by .gsc
                circle.radius * window.gsc
            );
        },

        // Constructor for point type
        point: function(x, y) {
            var p = {
                x: Math.round(x),
                y: Math.round(y)
            };

            return p;
        },

        // Constructor for rect type
        rect: function(x, y, w, h) {
            var r = {
                x: Math.round(x),
                y: Math.round(y),
                width: Math.round(w),
                height: Math.round(h)
            };

            return r;
        },

        // Constructor for circle type
        circle: function(x, y, r) {
            var c = {
                x: Math.round(x),
                y: Math.round(y),
                radius: Math.round(r)
            };

            return c;
        },

        // Fast atan2
        fastAtan2: function(y, x) {
            const QPI = Math.PI / 4;
            const TQPI = 3 * Math.PI / 4;
            var r = 0.0;
            var angle = 0.0;
            var abs_y = Math.abs(y) + 1e-10;
            if (x < 0) {
                r = (x + abs_y) / (abs_y - x);
                angle = TQPI;
            } else {
                r = (x - abs_y) / (x + abs_y);
                angle = QPI;
            }
            angle += (0.1963 * r * r - 0.9817) * r;
            if (y < 0) {
                return -angle;
            }

            return angle;
        },

        // Adjusts zoom in response to the mouse wheel.
        setZoom: function(e) {
            // Scaling ratio
            if (window.gsc) {
                window.gsc *= Math.pow(0.9, e.wheelDelta / -120 || e.detail / 2 || 0);
            }
        },

        // Restores zoom to the default value.
        resetZoom: function() {
            window.gsc = 0.9;
            window.desired_gsc = 0.9;
        },

        // Sets background to the given image URL.
        // Defaults to slither.io's own background.
        setBackground: function(url) {
            url = typeof url !== 'undefined' ? url : '/s/bg45.jpg';
            window.ii.src = url;
        },

        // Draw a rectangle on the canvas.
        drawRect: function(rect, color, fill, alpha) {
            if (alpha === undefined) alpha = 1;

            var context = window.mc.getContext('2d');
            var lc = canvasUtil.mapToCanvas({
                x: rect.x,
                y: rect.y
            });

            context.save();
            context.globalAlpha = alpha;
            context.strokeStyle = color;
            context.rect(lc.x, lc.y, rect.width * window.gsc, rect.height * window.gsc);
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw a circle on the canvas.
        drawCircle: function(circle, color, fill, alpha) {
            if (alpha === undefined) alpha = 1;
            if (circle.radius === undefined) circle.radius = 5;

            var context = window.mc.getContext('2d');
            var drawCircle = canvasUtil.circleMapToCanvas(circle);

            context.save();
            context.globalAlpha = alpha;
            context.beginPath();
            context.strokeStyle = color;
            context.arc(drawCircle.x, drawCircle.y, drawCircle.radius, 0, Math.PI * 2);
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw an angle.
        // @param {number} start -- where to start the angle
        // @param {number} angle -- width of the angle
        // @param {String|CanvasGradient|CanvasPattern} color
        // @param {boolean} fill
        // @param {number} alpha
        drawAngle: function(start, angle, color, fill, alpha) {
            if (alpha === undefined) alpha = 0.6;

            var context = window.mc.getContext('2d');

            context.save();
            context.globalAlpha = alpha;
            context.beginPath();
            context.moveTo(window.mc.width / 2, window.mc.height / 2);
            context.arc(window.mc.width / 2, window.mc.height / 2, window.gsc * 100, start, angle);
            context.lineTo(window.mc.width / 2, window.mc.height / 2);
            context.closePath();
            context.stroke();
            if (fill) {
                context.fillStyle = color;
                context.fill();
            }
            context.restore();
        },

        // Draw a line on the canvas.
        drawLine: function(p1, p2, color, width) {
            if (width === undefined) width = 5;

            var context = window.mc.getContext('2d');
            var dp1 = canvasUtil.mapToCanvas(p1);
            var dp2 = canvasUtil.mapToCanvas(p2);

            context.save();
            context.beginPath();
            context.lineWidth = width * window.gsc;
            context.strokeStyle = color;
            context.moveTo(dp1.x, dp1.y);
            context.lineTo(dp2.x, dp2.y);
            context.stroke();
            context.restore();
        },

        // Given the start and end of a line, is point left.
        isLeft: function(start, end, point) {
            return ((end.x - start.x) * (point.y - start.y) -
                (end.y - start.y) * (point.x - start.x)) > 0;

        },

        // Get distance squared
        getDistance2: function(x1, y1, x2, y2) {
            var distance2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
            return distance2;
        },

        // Get distance NOT squared
        getDistance: function(x1, y1, x2, y2) {
            var distance = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
            return distance;
        },

        // return unit vector in the direction of the argument
        unitVector: function(v) {
            var l = Math.sqrt(v.x*v.x + v.y*v.y);
            if (l>0) {
                return {
                    x: v.x/l,
                    y: v.y/l
                };
            } else {
                return {
                    x: 0,
                    y: 0
                };
            }
        },

        getDistance2FromSnake: function(point) {
            point.distance = canvasUtil.getDistance2(window.snake.xx, window.snake.yy,
                point.xx, point.yy);
            return point;
        },

        // Check if point in Rect
        pointInRect: function(point, rect) {
            if (rect.x <= point.x && rect.y <= point.y &&
                rect.x + rect.width >= point.x && rect.y + rect.height >= point.y) {
                return true;
            }
            return false;
        },

        // check if point is in polygon
        pointInPoly: function(point, poly) {
            if (point.x < poly.minx || point.x > poly.maxx ||
                point.y < poly.miny || point.y > poly.maxy) {
                return false;
            }
            var c = false;
            var i, j;
            for (i = 0, j = poly.pts.length-1; i < poly.pts.length; j = i++) {
                if ( ((poly.pts[i].y > point.y) != (poly.pts[j].y > point.y)) &&
                    (point.x < (poly.pts[j].x-poly.pts[i].x) * (point.y-poly.pts[i].y) / (poly.pts[j].y-poly.pts[i].y) + poly.pts[i].x) ) {
                    c = !c;
                }
            }
            return c;
        },

        addPolyBox: function(poly) {
            var minx = poly.pts[0].x;
            var maxx = poly.pts[0].x;
            var miny = poly.pts[0].y;
            var maxy = poly.pts[0].y;
            for (var p=1, l=poly.pts.length; p<l; p++) {
                if (poly.pts[p].x < minx) {
                    minx = poly.pts[p].x;
                }
                if (poly.pts[p].x > maxx) {
                    maxx = poly.pts[p].x;
                }
                if (poly.pts[p].y < miny) {
                    miny = poly.pts[p].y;
                }
                if (poly.pts[p].y > maxy) {
                    maxy = poly.pts[p].y;
                }
            }
            return {
                pts: poly.pts,
                minx: minx,
                maxx: maxx,
                miny: miny,
                maxy: maxy
            };
        },

        cross: function(o, a, b) {
            return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
        },

        convexHull: function(points) {
            points.sort(function(a, b) {
                return a.x == b.x ? a.y - b.y : a.x - b.x;
            });

            var lower = [];
            for (var i = 0, l = points.length; i < l; i++) {
                while (lower.length >= 2 && canvasUtil.cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
                    lower.pop();
                }
                lower.push(points[i]);
            }

            var upper = [];
            for (var i = points.length - 1; i >= 0; i--) {
                while (upper.length >= 2 && canvasUtil.cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
                    upper.pop();
                }
                upper.push(points[i]);
            }

            upper.pop();
            lower.pop();
            return lower.concat(upper);
        },

        // Check if circles intersect
        circleIntersect: function(circle1, circle2) {
            var bothRadii = circle1.radius + circle2.radius;
            var dx = circle1.x - circle2.x;
            var dy = circle1.y - circle2.y;

            // Pretends the circles are squares for a quick collision check.
            // If it collides, do the more expensive circle check.
            if (dx + bothRadii > 0 && dy + bothRadii > 0 &&
                dx - bothRadii < 0 && dy - bothRadii < 0) {

                var distance2 = canvasUtil.getDistance2(circle1.x, circle1.y, circle2.x, circle2.y);
                if (distance2 < bothRadii * bothRadii) {
                    if (window.visualDebugging) {
                        var collisionPointCircle = canvasUtil.circle(
                            ((circle1.x * circle2.radius) + (circle2.x * circle1.radius)) /
                            bothRadii,
                            ((circle1.y * circle2.radius) + (circle2.y * circle1.radius)) /
                            bothRadii,
                            5
                        );
                        canvasUtil.drawCircle(circle2, 'red', true);
                        canvasUtil.drawCircle(collisionPointCircle, 'cyan', true);
                    }
                    return true;
                }
            }
            return false;
        }
    };
})();

var bot = window.bot = (function() {
    return {
        isBotRunning: false,
        isBotEnabled: true,
        lookForFood: false,
        collisionPoints: [],
        collisionAngles: [],
        scores: [],
        foodTimeout: undefined,
        sectorBoxSide: 0,
        defaultAccel: 0,
        sectorBox: {},
        currentFood: {},
        opt: {
            // These are the bot's default options
            // If you wish to customise these, use
            // customBotOptions above
            targetFps: 30,
            arcSize: Math.PI / 8,
            radiusMult: 10,
            foodAccelSize: 60,
            foodAccelAngle: Math.PI / 3,
            foodFrames: 4,
            foodRoundSize: 5,
            foodRoundAngle: Math.PI / 8,
            foodSmallSize: 10,
            rearHeadAngle: 3 * Math.PI / 4,
            rearHeadDir: Math.PI / 2,
            radiusApproachSize: 5,
            radiusAvoidSize: 25
        },
        targetArea: {
            x: 20000,
            y: 20000
        },
        MID_X: 0,
        MID_Y: 0,
        MAP_R: 0,

        getSnakeWidth: function(sc) {
            if (sc === undefined) sc = window.snake.sc;
            return Math.round(sc * 29.0);
        },

        quickRespawn: function() {
            window.dead_mtm = 0;
            window.login_fr = 0;

            bot.isBotRunning = false;
            window.forcing = true;
            window.connect();
            window.forcing = false;
        },

        every: function() {
            bot.MID_X = window.grd;
            bot.MID_Y = window.grd;
            bot.MAP_R = window.grd * 0.98;

            bot.sectorBoxSide = Math.floor(Math.sqrt(window.sectors.length)) * window.sector_size;
            bot.sectorBox = canvasUtil.rect(
                window.snake.xx - (bot.sectorBoxSide / 2),
                window.snake.yy - (bot.sectorBoxSide / 2),
                bot.sectorBoxSide, bot.sectorBoxSide);
            // if (window.visualDebugging) canvasUtil.drawRect(bot.sectorBox, '#c0c0c0', true, 0.1);

            bot.cos = Math.cos(window.snake.ang);
            bot.sin = Math.sin(window.snake.ang);

            bot.speedMult = window.snake.sp / 5.78;
            bot.snakeRadius = bot.getSnakeWidth() / 2;
            bot.snakeWidth = bot.getSnakeWidth();

            bot.sidecircle_r = canvasUtil.circle(
                window.snake.lnp.xx -
                ((window.snake.lnp.yy + bot.sin * bot.snakeWidth) -
                    window.snake.lnp.yy),
                window.snake.lnp.yy +
                ((window.snake.lnp.xx + bot.cos * bot.snakeWidth) -
                    window.snake.lnp.xx),
                bot.snakeWidth * bot.speedMult
            );

            bot.sidecircle_l = canvasUtil.circle(
                window.snake.lnp.xx +
                ((window.snake.lnp.yy + bot.sin * bot.snakeWidth) -
                    window.snake.lnp.yy),
                window.snake.lnp.yy -
                ((window.snake.lnp.xx + bot.cos * bot.snakeWidth) -
                    window.snake.lnp.xx),
                bot.snakeWidth * bot.speedMult
            );

            // real points on snake, first head, last tail
            bot.pts = [];
            for (var pts = window.snake.pts.length-1; pts >=0 ; pts--) {
                if (!window.snake.pts[pts].dying) {
                    bot.pts.push({x: window.snake.pts[pts].xx, y: window.snake.pts[pts].yy});
                }
            }
            // add distance along the snake measured from the head
            bot.len = 0.0;
            bot.pts[0].len = 0.0;
            for (var p=1; p<bot.pts.length; p++) {
                bot.len += canvasUtil.getDistance(bot.pts[p-1].x, bot.pts[p-1].y, bot.pts[p].x, bot.pts[p].y);
                bot.pts[p].len = bot.len;
            }
        },

        bodyDangerZone: function(offset, targetPoint, targetPointNormal, closePointDist, pastTargetPoint, closePoint) {
            var head = {x: window.snake.xx,
                        y: window.snake.yy};
            var pts = [
                {
                    x:head.x - offset*bot.sin,
                    y:head.y + offset*bot.cos
                },
                {
                    x:head.x + bot.snakeWidth*bot.cos + offset*(bot.cos - bot.sin),
                    y:head.y + bot.snakeWidth*bot.sin + offset*(bot.sin + bot.cos)
                },
                {
                    x:head.x + 1.75*bot.snakeWidth*bot.cos + 0.3*bot.snakeWidth*bot.sin + offset*(bot.cos - bot.sin),
                    y:head.y + 1.75*bot.snakeWidth*bot.sin - 0.3*bot.snakeWidth*bot.cos + offset*(bot.sin + bot.cos)
                },
                {
                    x:head.x + 2.5*bot.snakeWidth*bot.cos + 0.7*bot.snakeWidth*bot.sin + offset*(bot.cos - bot.sin),
                    y:head.y + 2.5*bot.snakeWidth*bot.sin - 0.7*bot.snakeWidth*bot.cos + offset*(bot.sin + bot.cos)
                },
                {
                    x:head.x + 3*bot.snakeWidth*bot.cos + 1.2*bot.snakeWidth*bot.sin + offset*bot.cos,
                    y:head.y + 3*bot.snakeWidth*bot.sin - 1.2*bot.snakeWidth*bot.cos + offset*bot.sin
                },
                {
                    x: bot.pts[targetPoint].x + targetPointNormal.x*(offset + 0.5*Math.max(closePointDist,0)),
                    y: bot.pts[targetPoint].y + targetPointNormal.y*(offset + 0.5*Math.max(closePointDist,0))
                },
                {
                    x:bot.pts[pastTargetPoint].x + targetPointNormal.x*offset,
                    y:bot.pts[pastTargetPoint].y + targetPointNormal.y*offset
                },
                bot.pts[pastTargetPoint],
                bot.pts[targetPoint],
                bot.pts[closePoint]
            ];
            pts = canvasUtil.convexHull(pts);
            var poly = {
                pts: pts
            };
            poly = canvasUtil.addPolyBox(poly);
            return (poly);
        },

        // Main bot
        go: function() {
            bot.every();

            var head = {x: window.snake.xx,
                        y: window.snake.yy};

            // look for a point on own tail closest to window.snake.xx, window.snake.xx
            // tail is everything farther than 8 widths from the head
            var closePoint = -1;
            var closePointDist = -1;
            for (var p=bot.pts.length-2; p>=0 && bot.pts[p].len>8*bot.snakeWidth; p--) {
                var pen = canvasUtil.getDistance2(window.snake.xx, window.snake.yy, bot.pts[p].x, bot.pts[p].y);
                if (closePointDist < 0 || pen < closePointDist) {
                    closePointDist = pen;
                    closePoint = p;
                }
            }

            if (closePoint<0) {
                return;
            }
            // a point just a bit further
            var closePointNext = closePoint;
            while (closePointNext>0 && bot.pts[closePoint].len - bot.pts[closePointNext].len < bot.snakeWidth) {
                closePointNext--;
            }

            // compute distance from the body at closePointDist
            var closePointTangent = canvasUtil.unitVector({x: bot.pts[closePointNext].x-bot.pts[closePoint].x, y: bot.pts[closePointNext].y-bot.pts[closePoint].y});
            var closePointNormal = {
                x: -closePointTangent.y,
                y:  closePointTangent.x
            };
            closePointDist =
                closePointNormal.x*(head.x - bot.pts[closePoint].x) +
                closePointNormal.y*(head.y - bot.pts[closePoint].y);

            // construct polygon for snake inside
            var bot_pts_length = bot.pts.length;
            var insidePolygonStart = 0;
            while (bot.pts[insidePolygonStart].len < 5*bot.snakeWidth && insidePolygonStart < bot_pts_length-1) {
                insidePolygonStart ++;
            }
            var insidePolygonEnd = 0;
            while (bot.pts[insidePolygonEnd].len-bot.pts[closePoint].len < 5*bot.snakeWidth && insidePolygonEnd < bot_pts_length-1) {
                insidePolygonEnd ++;
            }
            var insidePolygon = canvasUtil.addPolyBox({
                pts: bot.pts.slice(insidePolygonStart, 1+insidePolygonEnd)
            });

            // get target point; this is an estimate where we land if we hurry
            var targetPointFar = 0.5*bot.snakeWidth + Math.max(0,closePointDist) +
                2*bot.snakeWidth * Math.max(0, bot.cos*closePointNormal.x + bot.sin*closePointNormal.y);
            var targetPoint = closePoint;
            while (targetPoint>0 && bot.pts[closePoint].len - bot.pts[targetPoint].len < 0.5*targetPointFar) {
                targetPoint--;
            }

            if (targetPoint == 0 || targetPoint == bot.pts.length-1) {
                return;
            }
            // normal vector at the target point
            var targetPointNormal = canvasUtil.unitVector({
                x: -bot.pts[targetPoint-1].y+bot.pts[targetPoint+1].y,
                y: bot.pts[targetPoint-1].x-bot.pts[targetPoint+1].x
            });

            var pastTargetPoint = targetPoint;
            while (pastTargetPoint>0 && bot.pts[targetPoint].len - bot.pts[pastTargetPoint].len < 3*bot.snakeWidth) {
                pastTargetPoint--;
            }

            // look for danger from enemies
            var enemyBodyOffsetDelta=0.25*bot.snakeWidth;
            var safeZone={
                x: bot.pts[targetPoint].x,
                y: bot.pts[targetPoint].y,
                r: 3*targetPointFar,
                r2: 0.0
            };
            safeZone.r2 = safeZone.r*safeZone.r;
            var enemyHeadDist2=64*64*bot.snakeWidth*bot.snakeWidth;
            for (var snake=0, snakesNum=window.snakes.length; snake<snakesNum; snake++) {
                if (window.snakes[snake].id !== window.snake.id && window.snakes[snake].alive_amt === 1) {
                    var enemyHead = {
                        x: window.snakes[snake].xx,
                        y: window.snakes[snake].yy
                    };
                    var enemyAhead = {
                        x: window.snakes[snake].xx + Math.cos(window.snakes[snake].ang)*bot.snakeWidth,
                        y: window.snakes[snake].yy + Math.sin(window.snakes[snake].ang)*bot.snakeWidth
                    };
                    // heads
                    if (!canvasUtil.pointInPoly(enemyHead, insidePolygon)) {
                        enemyHeadDist2 = Math.min(
                            enemyHeadDist2,
                            canvasUtil.getDistance2( enemyHead.x,  enemyHead.y, safeZone.x, safeZone.y),
                            canvasUtil.getDistance2(enemyAhead.x, enemyAhead.y, safeZone.x, safeZone.y));
                    }
                    // bodies
                    var offsetSet = false;
                    var offset = 0.0;
                    var cpolbody={};
                    for (var pts = 0, ptsNum=window.snakes[snake].pts.length; pts<ptsNum; pts++) {
                        if (!window.snakes[snake].pts[pts].dying) {
                            var point = {x: window.snakes[snake].pts[pts].xx, y: window.snakes[snake].pts[pts].yy};
                            while (true) {
                                if (!offsetSet || (enemyBodyOffsetDelta>=-bot.snakeWidth && canvasUtil.pointInPoly(point, cpolbody))) {
                                    if (!offsetSet) {
                                        offsetSet = true;
                                    } else {
                                        enemyBodyOffsetDelta -= 0.0625*bot.snakeWidth;
                                    }
                                    offset = 0.5*(bot.snakeWidth + bot.getSnakeWidth(window.snakes[snake].sc)) + enemyBodyOffsetDelta;
                                    cpolbody = bot.bodyDangerZone(offset, targetPoint, targetPointNormal, closePointDist, pastTargetPoint, closePoint);
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            var enemyHeadDist = Math.sqrt(enemyHeadDist2);

            // plot inside polygon
            if (window.visualDebugging) {
                var l = insidePolygon.pts.length;
                for (var p=0; p<l; p++) {
                    var q = p+1;
                    if (q == l) {
                        q = 0;
                    }
                    canvasUtil.drawLine(
                        {x: insidePolygon.pts[p].x, y: insidePolygon.pts[p].y},
                        {x: insidePolygon.pts[q].x, y: insidePolygon.pts[q].y},
                        'orange');
                }
            }

            // mark closePoint
            if (window.visualDebugging) {
                canvasUtil.drawCircle(canvasUtil.circle(
                    bot.pts[closePoint].x,
                    bot.pts[closePoint].y,
                    bot.snakeWidth*0.25
                ), 'white', false);
            }

            // mark safeZone
            if (window.visualDebugging) {
                canvasUtil.drawCircle(canvasUtil.circle(
                    safeZone.x,
                    safeZone.y,
                    safeZone.r
                ), 'white', false);
                canvasUtil.drawCircle(canvasUtil.circle(
                    safeZone.x,
                    safeZone.y,
                    0.2*bot.snakeWidth
                ), 'white', false);
            }

            // draw sample cpolbody
            if (window.visualDebugging) {
                var soffset = 0.5*bot.snakeWidth;
                var scpolbody = bot.bodyDangerZone(offset, targetPoint, targetPointNormal, closePointDist, pastTargetPoint, closePoint);
                for (var p=0; p<scpolbody.length; p++) {
                    var q = p+1;
                    if (q == scpolbody.length) {
                        q = 0;
                    }
                    canvasUtil.drawLine(
                        {x: scpolbody[p].x, y: scpolbody[p].y},
                        {x: scpolbody[q].x, y: scpolbody[q].y},
                        'white');
                }
            }

            // TAKE ACTION
            var targetCourse = 0.0;
            // angle wrt closePointTangent
            var currentCourse = Math.asin(Math.max(-1,Math.min(1,bot.cos*closePointNormal.x + bot.sin*closePointNormal.y)));
            if (true) {
                // expand?
                targetCourse = currentCourse + 0.125;
                // enemy head nearby?
                targetCourse = Math.min(targetCourse, -2*(safeZone.r - enemyHeadDist)/bot.snakeWidth);
                // enemy body nearby?
                targetCourse = Math.min(targetCourse, targetCourse+(enemyBodyOffsetDelta-0.0625*bot.snakeWidth)/bot.snakeWidth);
                // small tail?
                var tailBehind = bot.len - bot.pts[closePoint].len;
                var targetDir = canvasUtil.unitVector({
                    x: bot.targetArea.x - head.x,
                    y: bot.targetArea.y - head.y
                });
                var driftQ = targetDir.x*closePointNormal.x + targetDir.y*closePointNormal.y;
                var allowTail = bot.snakeWidth*(2 - 0.5*driftQ);
                if (window.visualDebugging) {
                    canvasUtil.drawLine(
                        {x: head.x, y: head.y},
                        {x: head.x+ allowTail*targetDir.x, y: head.y + allowTail*targetDir.y},
                        'red');
                }
                targetCourse = Math.min(targetCourse, (tailBehind - allowTail + 0.5*(bot.snakeWidth - closePointDist))/bot.snakeWidth);
                // far away?
                targetCourse = Math.min(targetCourse, - 0.5*(closePointDist - 4*bot.snakeWidth)/bot.snakeWidth);
            }
            // final corrections
            // too fast in?
            targetCourse = Math.max(targetCourse, -0.75 * closePointDist/bot.snakeWidth);
            // too fast out?
            targetCourse = Math.min(targetCourse, 1.0);

            var goalDir = {
                x: closePointTangent.x*Math.cos(targetCourse) - closePointTangent.y*Math.sin(targetCourse),
                y: closePointTangent.y*Math.cos(targetCourse) + closePointTangent.x*Math.sin(targetCourse)
            };
            var goal={
                x: head.x + goalDir.x * 4 * bot.snakeWidth,
                y: head.y + goalDir.y * 4 * bot.snakeWidth
            };

            if (window.goalCoordinates) {
                window.goalCoordinates.x = 0.75*window.goalCoordinates.x + 0.25*goal.x;
                window.goalCoordinates.y = 0.75*window.goalCoordinates.y + 0.25*goal.y;
            } else {
                window.goalCoordinates = {
                    x: Math.round(goal.x),
                    y: Math.round(goal.y)
                };
            }
            canvasUtil.setMouseCoordinates(canvasUtil.mapToMouse(window.goalCoordinates));
        }
    };
})();

// 149.202.210.74:446

var userInterface = window.userInterface = (function() {
    // Save the original slither.io functions so we can modify them, or reenable them later.
    var original_keydown = document.onkeydown;
    var original_onmouseDown = window.onmousedown;
    var original_oef = window.oef;
    var original_redraw = window.redraw;
    var original_onmousemove = window.onmousemove;

    window.oef = function() {};
    window.redraw = function() {};

    // Modify the redraw()-function to remove the zoom altering code
    // and replace b.globalCompositeOperation = "lighter"; to "hard-light".
    var original_redraw_string = original_redraw.toString();
    var new_redraw_string = original_redraw_string.replace(
        'gsc!=f&&(gsc<f?(gsc+=2E-4,gsc>=f&&(gsc=f)):(gsc-=2E-4,gsc<=f&&(gsc=f)))', '');
    // https://github.com/ErmiyaEskandary/Slither.io-bot/issues/315
    //new_redraw_string = new_redraw_string.replace(/b.globalCompositeOperation="lighter"/gi,
    //    'b.globalCompositeOperation="hard-light"');
    var new_redraw = new Function(new_redraw_string.substring(
        new_redraw_string.indexOf('{') + 1, new_redraw_string.lastIndexOf('}')));

    return {
        overlays: {},

        initOverlays: function() {
            var botOverlay = document.createElement('div');
            botOverlay.style.position = 'fixed';
            botOverlay.style.right = '5px';
            botOverlay.style.bottom = '112px';
            botOverlay.style.width = '150px';
            botOverlay.style.height = '85px';
            // botOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            botOverlay.style.color = '#C0C0C0';
            botOverlay.style.fontFamily = 'Consolas, Verdana';
            botOverlay.style.zIndex = 999;
            botOverlay.style.fontSize = '14px';
            botOverlay.style.padding = '5px';
            botOverlay.style.borderRadius = '5px';
            botOverlay.className = 'nsi';
            document.body.appendChild(botOverlay);

            var serverOverlay = document.createElement('div');
            serverOverlay.style.position = 'fixed';
            serverOverlay.style.right = '5px';
            serverOverlay.style.bottom = '5px';
            serverOverlay.style.width = '160px';
            serverOverlay.style.height = '14px';
            serverOverlay.style.color = '#C0C0C0';
            serverOverlay.style.fontFamily = 'Consolas, Verdana';
            serverOverlay.style.zIndex = 999;
            serverOverlay.style.fontSize = '14px';
            serverOverlay.className = 'nsi';
            document.body.appendChild(serverOverlay);

            var prefOverlay = document.createElement('div');
            prefOverlay.style.position = 'fixed';
            prefOverlay.style.left = '10px';
            prefOverlay.style.top = '75px';
            prefOverlay.style.width = '260px';
            prefOverlay.style.height = '210px';
            // prefOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            prefOverlay.style.color = '#C0C0C0';
            prefOverlay.style.fontFamily = 'Consolas, Verdana';
            prefOverlay.style.zIndex = 999;
            prefOverlay.style.fontSize = '14px';
            prefOverlay.style.padding = '5px';
            prefOverlay.style.borderRadius = '5px';
            prefOverlay.className = 'nsi';
            document.body.appendChild(prefOverlay);

            var statsOverlay = document.createElement('div');
            statsOverlay.style.position = 'fixed';
            statsOverlay.style.left = '10px';
            statsOverlay.style.top = '340px';
            statsOverlay.style.width = '140px';
            statsOverlay.style.height = '210px';
            // statsOverlay.style.background = 'rgba(0, 0, 0, 0.5)';
            statsOverlay.style.color = '#C0C0C0';
            statsOverlay.style.fontFamily = 'Consolas, Verdana';
            statsOverlay.style.zIndex = 998;
            statsOverlay.style.fontSize = '14px';
            statsOverlay.style.padding = '5px';
            statsOverlay.style.borderRadius = '5px';
            statsOverlay.className = 'nsi';
            document.body.appendChild(statsOverlay);

            userInterface.overlays.botOverlay = botOverlay;
            userInterface.overlays.serverOverlay = serverOverlay;
            userInterface.overlays.prefOverlay = prefOverlay;
            userInterface.overlays.statsOverlay = statsOverlay;
        },

        toggleOverlays: function() {
            Object.keys(userInterface.overlays).forEach(function(okey) {
                var oVis = userInterface.overlays[okey].style.visibility !== 'hidden' ?
                    'hidden' : 'visible';
                userInterface.overlays[okey].style.visibility = oVis;
                window.visualDebugging = oVis === 'visible';
            });
        },
        toggleLeaderboard: function() {
            window.leaderboard = !window.leaderboard;
            window.log('Leaderboard set to: ' + window.leaderboard);
            userInterface.savePreference('leaderboard', window.leaderboard);
            if (window.leaderboard) {
                // window.lbh.style.display = 'block';
                // window.lbs.style.display = 'block';
                // window.lbp.style.display = 'block';
                window.lbn.style.display = 'block';
            } else {
                // window.lbh.style.display = 'none';
                // window.lbs.style.display = 'none';
                // window.lbp.style.display = 'none';
                window.lbn.style.display = 'none';
            }
        },
        removeLogo: function() {
            if (typeof window.showlogo_iv !== 'undefined') {
                window.ncka = window.lgss = window.lga = 1;
                clearInterval(window.showlogo_iv);
                showLogo(true);
            }
        },
        // Save variable to local storage
        savePreference: function(item, value) {
            window.localStorage.setItem(item, value);
            userInterface.onPrefChange();
        },

        // Load a variable from local storage
        loadPreference: function(preference, defaultVar) {
            var savedItem = window.localStorage.getItem(preference);
            if (savedItem !== null) {
                if (savedItem === 'true') {
                    window[preference] = true;
                } else if (savedItem === 'false') {
                    window[preference] = false;
                } else {
                    window[preference] = savedItem;
                }
                window.log('Setting found for ' + preference + ': ' + window[preference]);
            } else {
                window[preference] = defaultVar;
                window.log('No setting found for ' + preference +
                    '. Used default: ' + window[preference]);
            }
            userInterface.onPrefChange();
            return window[preference];
        },

        // Saves username when you click on "Play" button
        playButtonClickListener: function() {
            userInterface.saveNick();
            userInterface.loadPreference('autoRespawn', false);
            userInterface.onPrefChange();
        },

        // Preserve nickname
        saveNick: function() {
            var nick = document.getElementById('nick').value;
            userInterface.savePreference('savedNick', nick);
        },

        // Hide top score
        hideTop: function() {
            var nsidivs = document.querySelectorAll('div.nsi');
            for (var i = 0; i < nsidivs.length; i++) {
                if (nsidivs[i].style.top === '4px' && nsidivs[i].style.width === '300px') {
                    nsidivs[i].style.visibility = 'hidden';
                    bot.isTopHidden = true;
                    window.topscore = nsidivs[i];
                }
            }
        },

        // Store FPS data
        framesPerSecond: {
            fps: 0,
            fpsTimer: function() {
                if (window.playing && window.fps && window.lrd_mtm) {
                    if (Date.now() - window.lrd_mtm > 970) {
                        userInterface.framesPerSecond.fps = window.fps;
                    }
                }
            }
        },

        onkeydown: function(e) {
            // Original slither.io onkeydown function + whatever is under it
            original_keydown(e);
            if (window.playing) {
                // Letter `T` to toggle bot
                if (e.keyCode === 84) {
                    window.goalCoordinates = null;
                    bot.isBotEnabled = !bot.isBotEnabled;
                }
                // Letter 'U' to toggle debugging (console)
                if (e.keyCode === 85) {
                    window.logDebugging = !window.logDebugging;
                    window.log('Log debugging set to: ' + window.logDebugging);
                    userInterface.savePreference('logDebugging', window.logDebugging);
                }
                // Letter 'Y' to toggle debugging (visual)
                if (e.keyCode === 89) {
                    window.visualDebugging = !window.visualDebugging;
                    window.log('Visual debugging set to: ' + window.visualDebugging);
                    userInterface.savePreference('visualDebugging', window.visualDebugging);
                }
                // Letter 'G' to toggle leaderboard
                if (e.keyCode === 71) {
                    userInterface.toggleLeaderboard(!window.leaderboard);
                }
                // Letter 'I' to toggle autorespawn
                if (e.keyCode === 73) {
                    window.autoRespawn = !window.autoRespawn;
                    window.log('Automatic Respawning set to: ' + window.autoRespawn);
                    userInterface.savePreference('autoRespawn', window.autoRespawn);
                }
                // Letter 'H' to toggle hidden mode
                if (e.keyCode === 72) {
                    userInterface.toggleOverlays();
                }
                // Letter 'B' to prompt for a custom background url
                if (e.keyCode === 66) {
                    var url = prompt('Please enter a background url:');
                    if (url !== null) {
                        canvasUtil.setBackground(url);
                    }
                }
                // Letter 'O' to change rendermode (visual)
                if (e.keyCode === 79) {
                    userInterface.toggleMobileRendering(!window.mobileRender);
                }
                // Letter 'A' to set targetArea
                if (e.keyCode === 65) {
                    if (window.snake.xx && window.snake.yy) {
                        bot.targetArea = {
                            x: Math.round(window.snake.xx),
                            y: Math.round(window.snake.yy)
                        };
                    }
                }
                // Letter 'D' to quick toggle collision radius
                if (e.keyCode === 68) {
                    if (bot.opt.radiusMult >
                        ((bot.opt.radiusAvoidSize - bot.opt.radiusApproachSize) /
                            2 + bot.opt.radiusApproachSize)) {
                        bot.opt.radiusMult = bot.opt.radiusApproachSize;
                    } else {
                        bot.opt.radiusMult = bot.opt.radiusAvoidSize;
                    }
                    window.log(
                        'radiusMult set to: ' + bot.opt.radiusMult);
                }
                // Letter 'Z' to reset zoom
                if (e.keyCode === 90) {
                    canvasUtil.resetZoom();
                }
                // Letter 'Q' to quit to main menu
                if (e.keyCode === 81) {
                    window.autoRespawn = false;
                    userInterface.quit();
                }
                // 'ESC' to quickly respawn
                if (e.keyCode === 27) {
                    bot.quickRespawn();
                }
                // Save nickname when you press "Enter"
                if (e.keyCode === 13) {
                    userInterface.saveNick();
                }
                userInterface.onPrefChange();
            }
        },

        onmousedown: function(e) {
            if (window.playing) {
                switch (e.which) {
                    // "Left click" to manually speed up the slither
                    case 1:
                        bot.defaultAccel = 1;
                        if (!bot.isBotEnabled) {
                            original_onmouseDown(e);
                        }
                        break;
                        // "Right click" to toggle bot in addition to the letter "T"
                    case 3:
                        bot.isBotEnabled = !bot.isBotEnabled;
                        window.goalCoordinates = null;
                        break;
                }
            } else {
                original_onmouseDown(e);
            }
            userInterface.onPrefChange();
        },

        onmouseup: function() {
            bot.defaultAccel = 0;
        },

        // Manual mobile rendering
        toggleMobileRendering: function(mobileRendering) {
            window.mobileRender = mobileRendering;
            window.log('Mobile rendering set to: ' + window.mobileRender);
            userInterface.savePreference('mobileRender', window.mobileRender);
            // Set render mode
            if (window.mobileRender) {
                window.render_mode = 1;
                window.want_quality = 0;
                window.high_quality = false;
            } else {
                window.render_mode = 2;
                window.want_quality = 1;
                window.high_quality = true;
            }
        },

        // Update stats overlay.
        updateStats: function() {
            var oContent = [];
            var median;

            if (bot.scores.length === 0) return;
            median = Math.round((bot.scores[Math.floor((bot.scores.length - 1) / 2)] +
                     bot.scores[Math.ceil((bot.scores.length - 1) / 2)]) / 2);
Object
            oContent.push('games played: ' + bot.scores.length);
            oContent.push('a: ' + Math.round(
                bot.scores.reduce(function(a, b) { return a + b; }) / (bot.scores.length)) +
                ' m: ' + median);

            for (var i = 0; i < bot.scores.length && i < 10; i++) {
                oContent.push(i + 1 + '. ' + bot.scores[i]);
            }

            userInterface.overlays.statsOverlay.innerHTML = oContent.join('<br/>');
        },

        onPrefChange: function() {
            // Set static display options here.
            var oContent = [];
            var ht = userInterface.handleTextColor;

            oContent.push('version: ' + GM_info.script.version);
            oContent.push('[T / Right click] bot: ' + ht(bot.isBotEnabled));
            oContent.push('[O] mobile rendering: ' + ht(window.mobileRender));
            oContent.push('[A] set target area');
            oContent.push('[D] quick radius change ' +
                bot.opt.radiusApproachSize + '/' + bot.opt.radiusAvoidSize);
            oContent.push('[I] auto respawn: ' + ht(window.autoRespawn));
            oContent.push('[G] leaderboard overlay: ' + ht(window.leaderboard));
            oContent.push('[Y] visual debugging: ' + ht(window.visualDebugging));
            oContent.push('[U] log debugging: ' + ht(window.logDebugging));
            oContent.push('[H] overlays');
            oContent.push('[B] change background');
            oContent.push('[Mouse Wheel] zoom');
            oContent.push('[Z] reset zoom');
            oContent.push('[ESC] quick respawn');
            oContent.push('[Q] quit to menu');

            userInterface.overlays.prefOverlay.innerHTML = oContent.join('<br/>');
        },

        onFrameUpdate: function() {
            // Botstatus overlay
            var oContent = [];

            if (window.playing && window.snake !== null) {
                oContent.push('fps: ' + userInterface.framesPerSecond.fps);
                oContent.push('sp: ' + window.snake.sp.toFixed(2));

                // Display the X and Y of the snake
                oContent.push('x: ' +
                    (Math.round(window.snake.xx) || 0) + ' y: ' +
                    (Math.round(window.snake.yy) || 0));

                oContent.push('Target Area:');
                oContent.push('x: ' + (bot.targetArea.x || 0)
                              + ' y: ' + (bot.targetArea.y || 0));

                if (window.bso !== undefined && userInterface.overlays.serverOverlay.innerHTML !==
                    window.bso.ip + ':' + window.bso.po) {
                    userInterface.overlays.serverOverlay.innerHTML =
                        window.bso.ip + ':' + window.bso.po;
                }
            }

            userInterface.overlays.botOverlay.innerHTML = oContent.join('<br/>');

            if (window.playing && window.visualDebugging) {
                // Only draw the goal when a bot has a goal.
                if (window.goalCoordinates && bot.isBotEnabled) {
                    var headCoord = {
                        x: window.snake.xx,
                        y: window.snake.yy
                    };
                    canvasUtil.drawLine(
                        headCoord,
                        window.goalCoordinates,
                        'green');
                    canvasUtil.drawCircle(window.goalCoordinates, 'red', true);
                }
            }
        },

        oefTimer: function() {
            var start = Date.now();
            // Original slither.io oef function + whatever is under it
            original_oef();
           // Modified slither.io redraw function
            new_redraw();

            if (window.playing && bot.isBotEnabled && window.snake !== null) {
                window.onmousemove = function() {};
                bot.isBotRunning = true;
                bot.go();
            } else if (bot.isBotEnabled && bot.isBotRunning) {
                bot.isBotRunning = false;
                if (window.lastscore && window.lastscore.childNodes[1]) {
                    bot.scores.push(parseInt(window.lastscore.childNodes[1].innerHTML));
                    bot.scores.sort(function(a, b) {
                        return b - a;
                    });
                    userInterface.updateStats();
                }

                if (window.autoRespawn) {
                    window.connect();
                }
            }

            if (!bot.isBotEnabled || !bot.isBotRunning) {
                window.onmousemove = original_onmousemove;
            }

            userInterface.onFrameUpdate();
            setTimeout(userInterface.oefTimer, (1000 / bot.opt.targetFps) - (Date.now() - start));
        },

        // Quit to menu
        quit: function() {
            if (window.playing && window.resetGame) {
                window.want_close_socket = true;
                window.dead_mtm = 0;
                if (window.play_btn) {
                    window.play_btn.setEnabled(true);
                }
                window.resetGame();
            }
        },

        // Update the relation between the screen and the canvas.
        onresize: function() {
            window.resize();
            // Canvas different size from the screen (often bigger).
            canvasUtil.canvasRatio = {
                x: window.mc.width / window.ww,
                y: window.mc.height / window.hh
            };
        },
        // Handles the text color of the bot preferences
        // enabled = green
        // disabled = red
        handleTextColor: function(enabled) {
            return '<span style=\"color:' +
                (enabled ? 'green;\">enabled' : 'red;\">disabled') + '</span>';
        }
    };
})();

// Main
(function() {
    window.play_btn.btnf.addEventListener('click', userInterface.playButtonClickListener);
    document.onkeydown = userInterface.onkeydown;
    window.onmousedown = userInterface.onmousedown;
    window.addEventListener('mouseup', userInterface.onmouseup);
    window.onresize = userInterface.onresize;

    // Hide top score
    userInterface.hideTop();

    // Overlays
    userInterface.initOverlays();

    // Load preferences
    userInterface.loadPreference('logDebugging', false);
    userInterface.loadPreference('visualDebugging', false);
    userInterface.loadPreference('autoRespawn', false);
    userInterface.loadPreference('mobileRender', false);
    userInterface.loadPreference('leaderboard', true);
    window.nick.value = userInterface.loadPreference('savedNick', 'Slither.io-bot');

    // Don't load saved options or apply custom options if
    // the user wants to use default options
    if (typeof(customBotOptions.useDefaults) !== 'undefined'
       && customBotOptions.useDefaults === true) {
        window.log('Ignoring saved / customised options per user request');
    } else {
        // Load saved options, if any
        var savedOptions = userInterface.loadPreference('options', null);
        if (savedOptions !== null) { // If there were saved options
            // Parse the options and overwrite the default bot options
            savedOptions = JSON.parse(savedOptions);
            if (Object.keys(savedOptions).length !== 0
                && savedOptions.constructor === Object) {
                Object.keys(savedOptions).forEach(function(key) {
                    window.bot.opt[key] = savedOptions[key];
                });
            }
            window.log('Found saved settings, overwriting default bot options');
        } else {
            window.log('No saved settings, using default bot options');
        }

        // Has the user customised the options?
        if (Object.keys(customBotOptions).length !== 0
            && customBotOptions.constructor === Object) {
            Object.keys(customBotOptions).forEach(function(key) {
                window.bot.opt[key] = customBotOptions[key];
            });
            window.log('Custom settings found, overwriting current bot options');
        }
    }

    // Save the bot options
    userInterface.savePreference('options', JSON.stringify(window.bot.opt));
    window.log('Saving current bot options');

    // Listener for mouse wheel scroll - used for setZoom function
    document.body.addEventListener('mousewheel', canvasUtil.setZoom);
    document.body.addEventListener('DOMMouseScroll', canvasUtil.setZoom);

    // Set render mode
    if (window.mobileRender) {
        userInterface.toggleMobileRendering(true);
    } else {
        userInterface.toggleMobileRendering(false);
    }
    // Remove laggy logo animation
    userInterface.removeLogo();
    // Unblocks all skins without the need for FB sharing.
    window.localStorage.setItem('edttsg', '1');

    // Remove social
    window.social.remove();

    // Maintain fps
    setInterval(userInterface.framesPerSecond.fpsTimer, 80);

    // Start!
    userInterface.oefTimer();
})();
