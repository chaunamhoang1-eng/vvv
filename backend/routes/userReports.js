import express from "express";
import Order from "../models/Order.js";

const router = express.Router();

/**
 * GET /api/reports
 *
 * Firebase auth is handled in server.js
 *
 * Supports:
 * - firebaseUid based users
 * - old email based users
 * - automatic migration of old orders
 *
 * Pagination:
 * /api/reports?page=1&limit=5
 */
router.get("/", async (req, res) => {
  try {

    /* ======================================================
       AUTH CHECK
    ====================================================== */

    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }


    const {
      uid,
      email
    } = req.firebaseUser;


    /* ======================================================
       PAGINATION
    ====================================================== */

    let page =
      parseInt(req.query.page, 10) || 1;

    let limit =
      parseInt(req.query.limit, 10) || 5;


    /*
      Keep pagination safe.

      Default = 5
      Maximum = 5
    */

    page =
      Math.max(page, 1);

    limit = 5;


    const skip =
      (page - 1) * limit;


    /* ======================================================
       USER FILTER
    ====================================================== */

    const userFilter = {
      $or: [
        {
          firebaseUid: uid
        },
        {
          email: email
        }
      ]
    };


    /* ======================================================
       TOTAL USER REPORTS
       IMPORTANT:
       This is different for every user.
    ====================================================== */

    const total =
      await Order.countDocuments(
        userFilter
      );


    /* ======================================================
       TOTAL PAGES
    ====================================================== */

    const totalPages =
      Math.ceil(
        total / limit
      );


    /*
      If user requests a page that no longer exists,
      return an empty list rather than crashing.
    */


    /* ======================================================
       FETCH ONLY CURRENT PAGE
    ====================================================== */

    const reports =
      await Order.find(
        userFilter
      )
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limit);


    /* ======================================================
       AUTO-MIGRATE OLD REPORTS
       EMAIL → FIREBASE UID
    ====================================================== */

    const unmigratedIds =
      reports
        .filter(
          report =>
            !report.firebaseUid
        )
        .map(
          report =>
            report._id
        );


    if (
      unmigratedIds.length > 0
    ) {

      await Order.updateMany(

        {
          _id: {
            $in: unmigratedIds
          }
        },

        {
          $set: {
            firebaseUid: uid
          }
        }

      );


      console.log(
        `✅ Migrated ${unmigratedIds.length} orders to firebaseUid`
      );

    }


    /* ======================================================
       RESPONSE
    ====================================================== */

    return res.json({

      success: true,

      reports,

      total,

      page,

      limit,

      totalPages

    });


  } catch (err) {

    console.error(
      "❌ Fetch reports error:",
      err
    );


    return res.status(500).json({

      success: false,

      error:
        "Failed to fetch reports"

    });

  }
});


export default router;
