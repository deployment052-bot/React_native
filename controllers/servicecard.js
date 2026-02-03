const Service = require("../model/servicecard");
const SERVICE_CONFIG = require("../config/serviceConfig");

exports.getServices = async (req, res) => {
  try {
    const {
      category,
      isMostBooked,
      isTopCategory,
      isNewLaunched,
      search,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 20,
    } = req.query;
  //  console.log(req.query)
    let filter = { isActive: true };
    let andConditions = [];

    if (category) {
      filter.category = category;
    }
     

    if (isMostBooked === "true") filter.isMostBooked = true;
    if (isTopCategory === "true") filter.isTopCategory = true;


    if (isNewLaunched === "true") {
      const days = 15;
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      andConditions.push({
        $or: [
          { isNewLaunched: true },
          { createdAt: { $gte: fromDate } },
        ],
      });
    }


    if (search) {
      andConditions.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { tags: { $in: [new RegExp(search, "i")] } },
          { specialization: { $in: [new RegExp(search, "i")] } },
        ],
      });
    }

  
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

   
    let sortOption = { createdAt: -1 };
    if (sort === "price_low") sortOption = { price: 1 };
    if (sort === "price_high") sortOption = { price: -1 };
    if (sort === "rating") sortOption = { rating: -1 };

   
    const skip = (page - 1) * limit;

    const services = await Service.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    const total = await Service.countDocuments(filter);
    //  console.log(total)
    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      limit: Number(limit),
      services,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



exports.getCategoriesWithServices = async (req, res) => {
  try {
    const { search, category, name } = req.query;

       
    if (name === "true") {
      const categories = await Service.distinct("category", {
        isActive: true,
      });

      return res.status(200).json({
        success: true,
        totalCategories: categories.length,
        categories, // ["AC Repair", "Electrician", ...]
      });
    }

    
    if (category) {
      const services = await Service.find({
        isActive: true,
        category: new RegExp(`^${category}$`, "i"),
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        totalCategories: 1,
        categories: [
          {
            category,
            services,
          },
        ],
      });
    }


    if (search) {
      const s = search.toLowerCase();

      const matchedCategories = SERVICE_CONFIG.filter((cat) => {
        if (cat.title.toLowerCase().includes(s)) return true;
        if (cat.keywords?.some(k => k.toLowerCase().includes(s))) return true;
        if (cat.subServices?.some(sub => sub.toLowerCase().includes(s)))
          return true;
        return false;
      });

      return res.status(200).json({
        success: true,
        totalCategories: matchedCategories.length,
        categories: matchedCategories.map(cat => ({
          category: cat.title,
          services: [],
        })),
      });
    }

   
    const services = await Service.find({ isActive: true })
      .sort({ createdAt: -1 });

    const categoryMap = {};

    services.forEach((service) => {
      const cat = service.category || "Others";

      if (!categoryMap[cat]) {
        categoryMap[cat] = {
          category: cat,
          services: [],
        };
      }

      categoryMap[cat].services.push(service);
    });

    res.status(200).json({
      success: true,
      totalCategories: Object.keys(categoryMap).length,
      categories: Object.values(categoryMap),
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.smartServiceSearch = async (req, res) => {
  try {
    const { search } = req.query;
    let matchedCategory = null;
    let matchedSubService = null;
    let services = [];

    if (search) {
      const s = search.toLowerCase();

      for (const cat of SERVICE_CONFIG) {
        if (
          cat.title.toLowerCase().includes(s) ||
          cat.keywords.some((k) => s.includes(k.toLowerCase()))
        ) {
          matchedCategory = cat;
          break;
        }

        const sub = cat.subServices.find((sub) =>
          sub.toLowerCase().includes(s)
        );
        if (sub) {
          matchedCategory = cat;
          matchedSubService = sub;
          break;
        }
      }
    }

    if (matchedCategory) {
      const regex = new RegExp(matchedSubService || search, "i");

      services = await Service.find({
        isActive: true,
        $or: [
          { category: new RegExp(matchedCategory.title, "i") },
          { specialization: new RegExp(matchedCategory.key, "i") },
          { title: regex },
          { tags: { $in: [regex] } },
        ],
      });
    } else if (search) {
      const regex = new RegExp(search, "i");
      services = await Service.find({
        isActive: true,
        $or: [
          { category: regex },
          { title: regex },
          { tags: { $in: [regex] } },
          { specialization: { $in: [regex] } },
        ],
      });
    } else {
      services = await Service.find({ isActive: true });
    }

    const map = {};
    services.forEach((s) => {
      const c = s.category || "Others";
      if (!map[c]) map[c] = { category: c, services: [] };
      map[c].services.push(s);
    });

    res.json({
      success: true,
      matchedFromConfig: !!matchedCategory,
      matchedCategory,
      matchedSubService,
      categories: Object.values(map),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

