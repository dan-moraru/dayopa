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
  //const center = [45.502376, -73.579273]; //downtownMtl
  const center = [45.440684, -73.685315]; //lachine
  const EPS_RADIUS = 0.02; // Radius around center
  const stTime = 24625450; // Example start time
  const du = 16 * 60; // Duration in minutes

  useEffect(() => {
    fetch('./sign_data_processed.json')
    .then((response) => response.text())
    .then((jsonText) => {
      const jsonData = JSON.parse(jsonText); // Parse JSON data

      // Filter and process parking data
      const processedData = jsonData
        .filter(sign => {
          // Calculate distance from center and ensure parsed data exists
          const distance = Math.hypot(sign.Latitude - center[0], sign.Longitude - center[1]);
          return distance < EPS_RADIUS && sign.parsed.length > 0;
        })
        .map(sign => ({
          ...sign,
          // Add finalrescolor using applySign
          finalrescolor: applySign(sign.parsed, stTime, du),
        }));

      // Set processed data to state
      setParkingSigns(processedData);
    })
    .catch((error) => {
      console.error('Error loading or parsing parking data:', error);
    });
  }, []);  // Only run once on mount

  // Define colors for the result
  const rescolors = ['green', 'orange', 'red'];

  const handlePolylineClick = (sign) => {
    console.log('Clicked on polyline:', sign);  // Log the entire object
  };

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100vh', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {/* Render polylines for each parking sign */}
      {rescolors.map(color => (
        parkingSigns
          .filter(sign => sign.finalrescolor === color) // Filter by final color
          .map((sign, idx) => (
            <Polyline
              key={`${sign.POTEAU_ID_POT}-${idx}`} // Unique key using sign ID
              positions={[
                [sign.segmentX1, sign.segmentY1], // Start coordinates
                [sign.segmentX2, sign.segmentY2]  // End coordinates
              ]}
              color={color}
              eventHandlers={{
                click: () => handlePolylineClick(sign), // Attach the click event handler
              }}
            />
          ))
      ))}
    </MapContainer>
  );
}
