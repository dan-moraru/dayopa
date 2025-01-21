import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const HALF_PARAM = 0.80;

// Helper function to parse epoch in minutes
const parseEpochInMins = (epochInMins) => {
  const date = new Date(epochInMins * 60000);
  const startDayInYear = date.getMonth() * 30 + date.getDate();
  const startDayInWeek = date.getDay();
  const startTimeInDay = date.getHours() * 60 + date.getMinutes();
  return [startDayInYear, startDayInWeek, startTimeInDay];
};

// Helper functions to process parking rules
const getForSummer = (signRules) => signRules.find(rule => rule[0] === 'forsummer')?.[1];
const getDays = (signRules) => signRules.find(rule => rule[0] === 'day')?.[1];
const getHour = (signRules) => signRules.find(rule => rule[0] === 'hour')?.[1];
const getMainRule = (signRules) => signRules.find(rule => rule[0] === 'mainrule')?.[1] || 'noparking';

// Helper function to calculate the duration for parking
const getDurationCanPark = (mainrule, signHour, startHourInDay) => {
  const [startHour, endHour] = signHour;
  if (startHour > endHour) {
    if (startHourInDay >= startHour || startHourInDay < endHour) {
      return mainrule === 'noparking' ? -1 : (24 * 60 - startHourInDay + startHour);
    }
    return startHour - startHourInDay;
  }
  
  if (startHourInDay >= startHour && startHourInDay < endHour) {
    return mainrule === 'noparking' ? -1 : endHour - startHourInDay;
  }
  return startHourInDay < startHour ? startHour - startHourInDay : 24 * 60 - startHourInDay;
};

// Function to apply parking rules
const applySign_ = (signRules, startTime, duration) => {
  const [startDayInYear, startDayInWeek, startTimeInDay] = startTime;

  console.log(Array.isArray(signRules));  // Should print true if signRules is an array
  console.log(signRules);
  /*
  
  TODO: HEYYYYYY, so signRules is undefined and therefore not an array
  Continue working from here
  
  */
  const forsummerRange = getForSummer(signRules);
  if (forsummerRange && (startDayInYear < forsummerRange[0] || startDayInYear > forsummerRange[1])) {
    return getMainRule(signRules) === 'noparking' ? 'green' : 'red';
  }

  const days = getDays(signRules);
  if (days && !days.includes(startDayInWeek)) {
    return getMainRule(signRules) === 'noparking' ? 'green' : 'red';
  }

  const hours = getHour(signRules);
  if (hours) {
    const timeWeHave = getDurationCanPark(getMainRule(signRules), hours, startTimeInDay);
    if (timeWeHave === -1) return 'red';
    return timeWeHave >= HALF_PARAM * duration ? 'green' : 'orange';
  }

  return getMainRule(signRules) === 'noparking' ? 'red' : 'green';
};

// Function to apply the sign rules based on parking data
const applySign = (signRules, startTimeInEpochMins, durationInMIns) => {
  const startTime = parseEpochInMins(startTimeInEpochMins);
  return applySign_(signRules, startTime, durationInMIns);
};

export default function TestMap() {
  const [parkingSigns, setParkingSigns] = useState([]);
  const center = [45.502376, -73.579273];
  const EPS_RADIUS = 0.02; // Radius around center
  const stTime = 24625450; // Example start time
  const du = 16 * 60; // Duration in minutes

  useEffect(() => {
    // Load and parse CSV file
    fetch('./parking_data.json')
      .then((response) => response.text())
      .then((csvText) => {
        const jsonData = JSON.parse(csvText); // Parse the JSON text into an object
       
        // Filter and process parking data
        const processedData = jsonData.map(sign => {
          const distance = Math.hypot(sign.Latitude - center[0], sign.Longitude - center[1]);
          return distance < EPS_RADIUS && sign.parsed.length > 0; // Only consider valid signs within radius
        }).map(sign => ({
          ...sign,
          finalrescolor: applySign(sign.parsed, stTime, du) // Apply the color based on rules
        }));

        setParkingSigns(processedData); // Set processed parking signs in state
      });
  }, []);  // Only run once on mount

  // Define colors for the result
  const rescolors = ['green', 'orange', 'red'];

  return (
    <MapContainer center={[45.5017, -73.5673]} zoom={11} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {/* Render polylines for each parking sign */}
      {rescolors.map(color => (
        parkingSigns
          .filter(sign => sign.finalrescolor === color) // Filter by color
          .map((sign, idx) => (
            <Polyline
              key={idx}
              positions={[ // Define polyline coordinates
                [sign.segmentX1, sign.segmentY1], // Start coordinates
                [sign.segmentX2, sign.segmentY2]  // End coordinates
              ]}
              color={color}  // Set color based on rules
            />
          ))
      ))}
    </MapContainer>
  );
}
