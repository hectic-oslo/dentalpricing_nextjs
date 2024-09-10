import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
let client;

async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }
  return client;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const clinicName = searchParams.get('name');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  if (!clinicName) {
    return NextResponse.json({ error: 'Clinic name is required' }, { status: 400 });
  }

  try {
    const client = await connectToDatabase();
    const db = client.db('dentalpricing');

    console.log('Searching for clinic:', clinicName);

    // Fetch basic clinic info
    const clinicInfo = await db.collection('pricedata')
      .findOne({ Name: clinicName });

    if (!clinicInfo) {
      console.log('Clinic not found');
      return NextResponse.json({ error: 'Clinic not found' }, { status: 404 });
    }

    // Fetch paginated treatments
    const skip = (page - 1) * limit;
    const treatments = await db.collection('pricedata')
      .find({ Name: clinicName })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Get total count of treatments
    const totalTreatments = await db.collection('pricedata')
      .countDocuments({ Name: clinicName });

    // Fetch Google reviews (assuming you have a separate collection for reviews)
    const reviews = await db.collection('reviews')
      .find({ clinicName: clinicName })
      .limit(5)  // Limit to 5 most recent reviews
      .toArray();

    // Construct the response object
    const formattedClinicData = {
      Name: clinicInfo.Name,
      Address: clinicInfo['Address 1'],
      Postcode: clinicInfo.Postcode,
      Website: clinicInfo.Website,
      Feepage: clinicInfo.Feepage,
      treatments: treatments.map(t => ({
        name: t.treatment,
        price: t.Price,
        category: t.Category
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalTreatments / limit),
        totalTreatments: totalTreatments
      },
      reviews: reviews
    };

    return NextResponse.json(formattedClinicData);
  } catch (error) {
    console.error('Error fetching clinic data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}